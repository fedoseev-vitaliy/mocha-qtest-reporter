const mocha = require("mocha");
const request = require("sync-request");


module.exports = function qTestReporter (runner, options) {
    mocha.reporters.Base.call(this, runner);
    let qTestConfig;
    try{
        qTestConfig = options.reporterOptions.configOptions ? options.reporterOptions.configOptions : require(path.join(process.cwd(), options.reporterOptions.configFile));
    } catch (err) {
        console.error(`Failed to load config. Error: ${err}`);
    }

    let test_log = {
        name: qTestConfig.name,
        automation_content: qTestConfig.automation_content,
        status: qTestConfig.statusMappings.passed,
        exe_start_date: "",
        exe_end_date: "",
        test_step_logs: []
    };
    let submitTestLogSync = (test_log_json) => { // https://support.qasymphony.com/hc/en-us/articles/205636095-9-Test-Run-APIs#Submit%20An%20Automation%20Test%20Log
        return request("POST", `https://${qTestConfig.host}/api/v3/projects/${qTestConfig.projectID}/test-runs/${qTestConfig.testRunID}/auto-test-logs`,
            {
                headers: {
                    "Host": qTestConfig.host,
                    "Authorization": qTestConfig.token,
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache"
                },
                body: test_log_json
            });
    };

    runner.on("start", () => {
        test_log.exe_start_date = runner.stats.start.toISOString();
    });

    // runner.on('suite', (suite) => {});

    // runner.on('suite end', (suite) => {});

    runner.on("pass", (test) => {
        let step = {
            description: test.fullTitle(),
            expected_result: "",
            status: qTestConfig.statusMappings.passed
        };
        test_log.test_step_logs.push(step);
    });

    runner.on("fail", (test, err) => {
        let step = {
            description: test.fullTitle(),
            expected_result: test.err.expected,
            actual_result: test.err.actual,
            status: qTestConfig.statusMappings.failed
        };
        test_log.test_step_logs.push(step);

        test_log.status = qTestConfig.statusMappings.failed;
    });

    runner.on("pending", (test) => {
        let step = {
            description: test.fullTitle(),
            expected_result: "",
            status: qTestConfig.statusMappings.incomplete
        };
        test_log.test_step_logs.push(step);
    });

    runner.on("end", () => {
        test_log.exe_end_date = this.runner.stats.end.toISOString();

        try {
            let res = submitTestLogSync(JSON.stringify(test_log));
            let message = res.getBody("utf8");
            let testRunsId = message.match(/test-runs\/(\d+)\//)[1];
            console.log(`Report submitted to qTest: https://${qTestConfig.host}/p/${qTestConfig.projectID}/portal/project#tab=testexecution&object=3&id=${testRunsId}`);
        }
        catch (err) {
            console.error("Failed to submit report to qTest: " + err);
        }
    });
}
