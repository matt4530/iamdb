// limitations: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html
import { IAM, AWSError } from "aws-sdk";

// IAMDB
/**
 * Free high-latency, low-capacity storage.
 * 
 * Store In Inline Policy, Role Policies
 * Space to consider is different from usable space, since some bytes
 * may be reserved for internal use like key names, or bytes occupied to 
 * pass AWS field validation.
 * 
 * Inline Policy data storage: (5,000 max)
 * - Inline Policy size: 2,028 bytes
 * - Policy name*: 128 bytes
 * 
 * Role Policy data storage: (5,000 max)
 * - Role Policy size: 10,240 bytes
 * - Role name*: 64 bytes
 * - Role Trust Policy*: 2,048 bytes
 * 
 * * = not implemented yet
 */
export class IAMDB {
  private readonly MAX_USER_INLINE_POLICY_SIZE_BYTES = 1500;
  private readonly MAX_ROLE_INLINE_POLICY_SIZE_BYTES = 9800;
  private _iam: IAM;
  constructor() {
    this._iam = new IAM();
  }
  async get(key: string): Promise<string | null> {
    try {
      const userPolicy = await this._iam.getUserPolicy({ UserName: `u-${key}`, PolicyName: "data" }).promise()
      const userDoc = JSON.parse(decodeURIComponent(userPolicy.PolicyDocument))
      const userInlineData = userDoc.Statement[0].Condition.StringLike["aws:userid"]

      if (userInlineData.length < this.MAX_USER_INLINE_POLICY_SIZE_BYTES)
        return userInlineData;

      try {
        const rolePolicy = await this._iam.getRolePolicy({ RoleName: `r-${key}`, PolicyName: "data" }).promise()
        const roleDoc = JSON.parse(decodeURIComponent(rolePolicy.PolicyDocument))
        const roleInlineData = roleDoc.Statement[0].Condition.StringLike["aws:userid"]
        return userInlineData + roleInlineData;
      } catch (error) {
        // it could be the exact number of bytes in the user inline policy, so 
        // the role might not exist
        return userInlineData;
      }
    } catch {
      return null
    }
  }
  list(type: string): string[] {
    return [];
  }
  async set(key: string, entry: IAMDBEntry): Promise<void> {

    // split tactic: Use first chunk of bytes to store in inline
    //               Use second chunk of bytes to store in role

    if (entry.data.length > this.MAX_USER_INLINE_POLICY_SIZE_BYTES + this.MAX_ROLE_INLINE_POLICY_SIZE_BYTES) {
      throw 'data too large to store'
    }


    let userChunk, roleChunk = null;

    if (entry.data.length > this.MAX_USER_INLINE_POLICY_SIZE_BYTES) {
      userChunk = entry.data.substr(0, this.MAX_USER_INLINE_POLICY_SIZE_BYTES);
      roleChunk = entry.data.substr(this.MAX_USER_INLINE_POLICY_SIZE_BYTES);
    }

    const PolicyDocument =
      `{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": "NONE:*",
                "Resource": "*",
                "Condition": {
                    "StringLike": {
                        "aws:userid": "${userChunk}"
                    }
                }
            }
          ]
      }`
    const params: IAM.PutUserPolicyRequest = {
      PolicyDocument,
      PolicyName: "data",
      UserName: `u-${key}`
    }

    try {
      await this._iam.putUserPolicy(params).promise()
    } catch (error) {
      if (error.code == "NoSuchEntity") {
        await this._iam.createUser({ UserName: `u-${key}` }).promise()
          .catch(x => {
            console.log("db.set.catch.createUser", x);
            throw 401;
          })
        await this._iam.putUserPolicy(params).promise()
          .catch(x => {
            console.log("db.set.catch.putUserPolicy", x);
            throw 401;
          })
      }
    }

    if (roleChunk) {
      const PolicyDocument =
        `{
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": "NONE:*",
                    "Resource": "*",
                    "Condition": {
                        "StringLike": {
                            "aws:userid": "${roleChunk}"
                        }
                    }
                }
            ]
        }`
      const params: IAM.PutRolePolicyRequest = {
        PolicyDocument,
        PolicyName: "data",
        RoleName: `r-${key}`
      }
      try {
        await this._iam.putRolePolicy(params).promise()
      } catch (error) {
        if (error.code == "NoSuchEntity") {
          const rolePolicyDocument = `{
            "Version": "2012-10-17",
            "Statement": {
              "Effect": "Allow",
              "Principal": {"Service": "iam.amazonaws.com"},
              "Action": "sts:AssumeRole"
            }
          }`
          await this._iam.createRole({ RoleName: `r-${key}`, AssumeRolePolicyDocument: rolePolicyDocument }).promise()
            .catch(x => {
              console.log("db.set.catch.createRole", x);
              throw 401;
            })
          await this._iam.putRolePolicy(params).promise()
            .catch(x => {
              console.log("db.set.catch.putRolePolicy", x);
              throw 401;
            })
        }


      }
    }
  }


  async delete(key: string): Promise<void> {
    await this._iam.deleteRolePolicy({ RoleName: `r-${key}`, PolicyName: "data" }).promise().catch(x => { console.log("db.delete.catch.deleteRolePolicy", x) })
    await this._iam.deleteUserPolicy({ UserName: `u-${key}`, PolicyName: "data" }).promise().catch(x => { console.log("db.delete.catch.deleteUserPolicy", x) })
    await this._iam.deleteRole({ RoleName: `r-${key}` }).promise().catch(x => { console.log("db.delete.catch.deleteRole", x) })
    await this._iam.deleteUser({ UserName: `u-${key}` }).promise().catch(x => { console.log("db.delete.catch.deleteUser", x) })
  }
  async printUsage(detailed: boolean = false): Promise<void> {
    const summary = await this._iam.getAccountSummary().promise();
    console.log("Objects:", summary.SummaryMap?.Users, "/", summary.SummaryMap?.UsersQuota);

    const theoreticalSize = (summary.SummaryMap?.Users || 0) * this.MAX_USER_INLINE_POLICY_SIZE_BYTES +
      (summary.SummaryMap?.Roles || 0) * this.MAX_ROLE_INLINE_POLICY_SIZE_BYTES;

    const maxTheoreticalSize = (summary.SummaryMap?.UsersQuota || 0) * this.MAX_USER_INLINE_POLICY_SIZE_BYTES +
      (summary.SummaryMap?.RolesQuota || 0) * this.MAX_ROLE_INLINE_POLICY_SIZE_BYTES;

    console.log("Bytes:", theoreticalSize, "/", maxTheoreticalSize, "bytes");
  }
}


export type IAMDBEntry = {
  data: string;
}
