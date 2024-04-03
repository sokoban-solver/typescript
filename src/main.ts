const fs = require("fs");

const { parseSokoban, solve } = require("./lib");

async function main() {
  const input = await new Promise<string>((resolve, reject) =>
    fs.readFile(0, "utf-8", (err: any, value: string) => {
      if (err) reject(err);
      else resolve(value);
    })
  );
  const mapAndInitialState = parseSokoban(input);
  if (!mapAndInitialState) {
    console.error("Could not parse input");
    process.exit(1);
  }
  const result = await solve(
    ...mapAndInitialState,
    undefined,
    (distance: number) => console.log(`wait: ${distance}`)
  );
  if (!result) {
    console.error("Could not solve");
    process.exit(1);
  }
  console.log(result);
}

main();
