
/**
 * ABSTRACT PLUGIN TYPE DEFINITIONS
 * 
 * @typedef {object} MetricOption
 * @property {string} name              The name of the metric
 * @property {string} pattern           Filter patter doc (https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/FilterAndPatternSyntax.html)
 * @property {boolean} staticName       If true, metric is naming from `name`. (default: false)
 * @property {string[]} [functions]     Default: ALL
 * @property {string} [namespace]       Override dynamic generated namespace (default: CustomMetrics/<serviceName>)
 * @property {string} [value]           The value to apply to each occurence (default: 1)
 * @property {string} [defaultValue]    Default: null
 */

/**
 * AWS TYPE DEFINITIONS
 * 
 * @typedef {object} AWSMetricFilterResourceProperty
 * @property {string} FilterPattern
 * @property {string} LogGroupName
 * @property {AWSMetricFilterResourceMetricTransformation[]} MetricTransformations 
 * 
 * @typedef {object} AWSMetricFilterResourceMetricTransformation
 * @property {string} MetricValue
 * @property {string} MetricNamespace
 * @property {string} MetricName
 * @property {string} DefaultValue
 * 
 * @typedef {object} AWSMetricFilterResource
 * @property {string} Type
 * @property {AWSMetricFilterResourceProperty} Properties
 * @property {MetricOption} __metricOption Internal used meta information
 */

/**
 * This plugin creates "AWS:Log:MetricFilter" resources using the `MetricOption` definition
 * under the serverless.yml location `custom.metrics`.
 * 
 * By default the plugin applies the metric resources to all functions, except
 * specific function-names are provided (`MetricOptions.functions`).
 * 
 * OPTION EXAMPLE:
 * 
 * ```
 * custom:
 *   metrics:
 *     - name: foo
 *       pattern: "{ $.statusCode != 200 }"
 *       functions:  (optional, default: ALL)
 *         - getBar
 *       namespace: "custom/metric" (optional, default: 'CustomMetrics/<serviceName>')
 * ```
 */
class MetricPlugin {
    constructor(serverless, options) {
        /**
         * @type {object}
         */
        this.serverless = serverless;

        /**
         * @type {object}
         */
        this.provider = serverless.getProvider('aws');

        /**
         * @type {MetricOption[]}
         */
        this.metricOptions = serverless.service.custom && serverless.service.custom.metrics
            ? serverless.service.custom.metrics
            : [];

        /**
         * @type {string}
         */
        this.functions = serverless.service.getAllFunctions();

        this.hooks = {
            'package:compileEvents': this.handler.bind(this)
        }
    }

    handler() {
        /**
         * @type {string}
         */
        this.dynamicNamespace = `${this.serverless.service.service}/${this.serverless.service.provider.stage}`;

        /**
         * @type {AWSMetricFilterResource[]}
         */

        this.functions
            .map((functionName) => this.createMetricFilterResources(functionName))
            .forEach(({ functionName, resources }) => {
                resources.forEach((resource) => {
                    /**
                     * @type {MetricOption}
                     */
                    const metricOption = resource.__metricOption;
                    const resourceName = `${functionName}MetricFilter${metricOption.name}`;
                    this.registerResource(resourceName, resource);
                })
            });
    }

    /**
     * @param {string} functionName 
     * @returns {{functionName: string, resources: AWSMetricFilterResource[]}}
     */
    createMetricFilterResources(functionName) {
        const resources = this.metricOptions
            .filter((option) => {
                if (option.functions && option.functions.length) {
                    return option.functions.indexOf(functionName) !== -1;
                } else {
                    return true;
                }
            })
            .map((option) => this.createAWSMetricResource(functionName, option));

        return { functionName, resources };
    }

    /**
     * AWS compatible metric resource creation.
     * 
     * @param {string} functionName
     * @param {MetricOption} metricOptions 
     * @returns {AWSMetricFilterResource}
     */
    createAWSMetricResource(functionName, metricOptions) {
        const { name, staticName = false, namespace, pattern, value = '1', defaultValue } = metricOptions;
        const logGroupLogicalId = this.provider.naming.getLogGroupLogicalId(functionName);
        const logGroup = this.serverless.service.provider.compiledCloudFormationTemplate.Resources[logGroupLogicalId];
        const logGroupName = logGroup.Properties.LogGroupName;
        
        const normalizedName = this.provider.naming.normalizeName(functionName);


        /**
         * @type {AWSMetricFilterResource}
         */
        const resource = {
            __metricOption: metricOptions,
            Type: 'AWS::Logs::MetricFilter',
            DependsOn: logGroupLogicalId,
            Properties: {
                FilterPattern: pattern,
                LogGroupName: logGroupName,
                MetricTransformations: [
                    {
                        MetricName: (staticName) ? name : `${normalizedName}-${name}`,
                        MetricNamespace: namespace || dynamicNamespace,
                        MetricValue: value,
                        DefaultValue: defaultValue,
                    }
                ]
            }
        }
        return resource;
    }

    /**
     * Register a aws resource OR override.
     * 
     * @param {string} name 
     * @param {AWSMetricFilterResource} resource
     */
    registerResource(name, resource) {
        delete resource.__metricOption; // delete associated meta information
        if (!this.serverless.service.provider.compiledCloudFormationTemplate.Resources) {
            this.serverless.service.provider.compiledCloudFormationTemplate.Resources = {};
        }
        const normalizedName = this.provider.naming.normalizeNameToAlphaNumericOnly(name);
        this.serverless.service.provider.compiledCloudFormationTemplate.Resources[normalizedName] = resource;
    }
}

module.exports = MetricPlugin;
