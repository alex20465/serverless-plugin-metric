
/**
 * ABSTRACT PLUGIN TYPE DEFINITIONS
 * 
 * @typedef {object} MetricOption
 * @property {string} name              The name of the metric
 * @property {string} pattern           Filter patter doc (https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/FilterAndPatternSyntax.html)
 * @property {string[]} [functions]     Default: ALL
 * @property {string} [namespace]       Override dynamic generated namespace (default: '<serviceName>/<stageName>')
 * @property {string} [value]           The value to apply to each occurence. (default: 1)
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
 * when specific function-names are provided (`MetricOptions.functions`).
 * 
 * OPTION EXAMPLE:
 * 
 * ```
 * custom:
 *   metrics:
 *     - name: foo
 *       pattern: "{ $.statusCode != 200 }"
 *       functions: (optional, default: ALL)
 *         - getBar
 *       namespace: "custom/metric" (optional, default: '<serviceName>/<stageName>')
 *       value: (optional, default: 1)
 * ```
 */
 class MetricPlugin {
    constructor(serverless, options) {
        /**
         * @type {string}
         */
        this.service = serverless.service.service;

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
        this.functions = this.getAllFunctions();

        this.hooks = {
            'package:compileEvents': this.handler.bind(this)
        }
    }

    handler() {
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
     * Get all the function names including support for an array of function files
     * @param {array|object} functions 
     * @returns {string[]}
     */
    getAllFunctions() {
        if (Array.isArray(this.serverless.service.functions)) {
            return this.serverless.service.functions.reduce((allFunctions, functionObject) => {
                return [...allFunctions, ...Object.keys(functionObject)];
            }, []);
        } else {
            return this.serverless.service.getAllFunctions();
        }
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
        const { name, namespace, pattern, value = '1' } = metricOptions;
        const stage = this.provider.getStage();
        const logGroupName = this.provider.naming.getLogGroupName(this.serverless.service.getFunction(functionName).name);
        const dynamicNamespace = `${this.service}/${stage}`;

        /**
         * @type {AWSMetricFilterResource}
         */
        const resource = {
            __metricOption: metricOptions,
            Type: 'AWS::Logs::MetricFilter',
            DependsOn: this.provider.naming.getLogGroupLogicalId(functionName),
            Properties: {
                FilterPattern: pattern,
                LogGroupName: logGroupName,
                MetricTransformations: [
                    {
                        MetricName: `${functionName}-${name}`,
                        MetricNamespace: namespace || dynamicNamespace,
                        MetricValue: value
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
