import { createDriverSchema } from "./validation/driver.schema.js";

const testCases = [
    {
        description: "Valid driver",
        input: {
            name: "Rahul",
            vehicleType: "BIKE",
        },
        shouldPass: true,
    },
    {
        description: "Name with extra whitespace",
        input: {
            name: "  Rahul  ",
            vehicleType: "BIKE",
        },
        shouldPass: true,
    },
    {
        description: "Empty name",
        input: {
            name: "",
            vehicleType: "BIKE",
        },
        shouldPass: false,
    },
    {
        description: "Invalid vehicle type",
        input: {
            name: "Rahul",
            vehicleType: "PLANE",
        },
        shouldPass: false,
    },
    {
        description: "Name is a number",
        input: {
            name: 123,
            vehicleType: "BIKE",
        },
        shouldPass: false,
    },
    {
        description: "Missing vehicle type",
        input: {
            name: "Rahul",
        },
        shouldPass: false,
    },
];

let passed = 0;
let failed = 0;

console.log("Starting driver validation tests...\n");

for (const testCase of testCases) {
    const result = createDriverSchema.safeParse(testCase.input);

    const testPassed = result.success === testCase.shouldPass;

    if (testPassed) {
        passed++;
        console.log(`✅ PASS: ${testCase.description}`);
    } else {
        failed++;
        console.log(`❌ FAIL: ${testCase.description}`);
    }

    if (result.success) {
        console.log("   Parsed data:", result.data);
    } else {
        console.log(
            "   Validation errors:",
            result.error.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
            }))
        );
    }

    console.log();
}

console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
    process.exitCode = 1;
}