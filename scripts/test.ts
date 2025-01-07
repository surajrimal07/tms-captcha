import fs from "node:fs";

import { solve_captcha } from "../src/evaluate";
import { ResultTypes } from "../src/interface";
import { kinds } from "../src/kinds";

let numbers = 0;
Object.values(kinds).map((kind) => {
	const files = fs.readdirSync(kind.data_path);

	files.map(async (filename) => {
		numbers++;
		const true_value = filename.substring(0, 6);

		const solve_result = await solve_captcha(`${kind.data_path}/${filename}`);

		if (solve_result.type === ResultTypes.Success) {
			console.log(`Solved: ${solve_result.value}`);
		} else {
			console.log(
				`Failed to solve! Correct: ${true_value} , Got: ${solve_result.value}!`,
			);
		}
	});
});
