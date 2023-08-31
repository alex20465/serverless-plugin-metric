
# Serverless Plugin Metric

A [serverless](http://www.serverless.com) plugin to automatically create `AWS:Logs:MetricFilter` resources.

## Requirements
- Node: >= 4.6.1
- Serverless: >= 1.24.1 (older versions not tested)

## Installation

NPM:

```
npm install serverless-plugin-metric --save-dev
```

Add the plugin to serverless.yml

```yaml
plugins:
  - serverless-plugin-metric
```

setup metrics:

```yaml
custom:
  metrics: # Array<MetricOption>
    - name: foo
      pattern: "{ $.statusCode != 200 }"
```

> Info: In order to display the metric on CloudWatch it is necessary to receive data.

## Metric option type-definitions:

```javascript
/** 
 * @typedef {object} MetricOption
 * @property {string} name              The name of the metric
 * @property {string} pattern           Filter patter doc (https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/FilterAndPatternSyntax.html)
 * @property {string[]} [functions]     Default: ALL
 * @property {string} [namespace]       Override dynamic generated namespace (default: '<serviceName>/<stageName>')
 * @property {string} [value]           The value to apply to each occurence. (default: 1)
 */
```