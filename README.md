# IAMDB

Free, high-latency, low-capacity cloud storage on AWS IAM.

```typescript
const db = new IAMDB();

const entry = { data: "cats-are-cool" };
await db.set("some-key", entry);
const res = await db.get("some-key");
await db.delete("some-key");

await db.printUsage();
```

## How it works

AWS IAM is a free identity and access management service provided by Amazon Web Services. Let's store data there.

IAM has desireable qualities that make it a great candidate to store data:

- free
- no rate-limits that I could find

IAM allows data to be stored in several places. This library takes advantage of bytes that can be stored in policies. Additional space, though small, is available elsewhere, such as usernames, trust policies, etc.

With minimal configuration, there is close to 56,500,000 bytes of storage space. Specificially, 5,000 unique keys, with values smaller than 11,300 bytes.

## Installation

IAMDB is available as a typescript file. Some dangerous(!) configuration to your AWS console is required.

1. Download `./iam.ts`
2. In your AWS console, attach the following very dangerous policy to a user or role.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "VisualEditor0",
      "Effect": "Allow",
      "Action": [
        "iam:GetUserPolicy",
        "iam:DeleteRolePolicy",
        "iam:PutUserPolicy",
        "iam:DeleteUserPolicy",
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:ListUserPolicies",
        "iam:PutRolePolicy",
        "iam:ListRolePolicies",
        "iam:CreateUser",
        "iam:DeleteUser",
        "iam:GetRolePolicy"
      ],
      "Resource": "*"
    }
  ]
}
```

3. Increase the quota for Roles in an AWS account to 5,000
   > To request a quota increase, sign in to the AWS Management Console and open the Service Quotas console at https://console.aws.amazon.com/servicequotas/. In the navigation pane, choose AWS services. On the navigation bar, choose the US East (N. Virginia) Region. Then search for IAM. Choose AWS Identity and Access Management (IAM), choose a quota, and follow the directions to request a quota increase. For more information, see Requesting a Quota Increase in the Service Quotas User Guide.

## Contribute

Just open a PR. I'm certain there are many places to squeeze in some more bytes.
