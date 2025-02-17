# Spark Spot Check

## Overview
Spark Spot Check is a testing module designed to verify full data retrievals from Storage Providers, enabling better identification and assessment of honest network participants.

## Prerequisites
Before running Spark Spot Check, you must install the [Zinnia runtime](https://github.com/CheckerNetwork/zinnia), which is the execution environment used by checker nodes to run checker modules. Follow the installation instructions in the [Zinnia CLI documentation](https://github.com/CheckerNetwork/zinnia/blob/main/cli/README.md#installation).

## Running Spot Checks
Once Zinnia is installed, you can execute Spark Spot Check with a simple command:

```sh
zinnia run main.js
```

## Configuration
All configuration options are managed through the `config.js` file. The following parameters can be customized:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `roundId` | Specifies which round to test retrievals from. When undefined, tests the current round. | `undefined` |
| `maxTasks` | Limits the number of tasks to check. When undefined, tests all available tasks. | `undefined` |
| `minerId` | Filters spot checks to a specific Storage Provider. Only processes tasks for the specified provider if found in the round. | `undefined` |
| `maxByteLength` | Limits the number of bytes to retrieve per file. When undefined, retrieves complete files. | `undefined` |
| `retrievalTasks` | Restricts spot checks to specific tasks. When undefined, processes all available tasks based on other configuration parameters. | `undefined` |
