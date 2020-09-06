import { IAMDB } from "./iam";


try {
  work();
} catch{

}

async function work() {
  const entry = { data: "cats-are-cool" }
  const largeEntry = { data: "x".repeat(3000) }// 3000 bytes
  let res;

  const db = new IAMDB();
  console.log("Setting");
  await db.set("some-key", entry)

  console.log("Setting large");
  await db.set("some-large-key", largeEntry);

  console.log("Getting");
  res = await db.get("some-key");
  console.log("Expect 'cats-are-cool' got ->", res)

  res = await db.get("non-existant-key");
  console.log("Expect `null` got ->", res)

  res = await db.get("some-large-key");
  console.log("Expect 'xxxxxx.....' got ->", res)

  console.log("")
  await db.printUsage();
  console.log("")

  console.log("Deleting some-large-key")
  await db.delete("some-large-key");

  console.log("Getting some-large-key")
  res = await db.get("some-large-key");
  console.log("Expect `null` got ->", res)

  console.log("")
  await db.printUsage();
}
