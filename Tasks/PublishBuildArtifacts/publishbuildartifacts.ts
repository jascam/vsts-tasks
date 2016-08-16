/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import os = require('os');
import path = require('path');
import tl = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');

tl.setResourcePath(path.join(__dirname, 'task.json'));

// content is a folder contain artifacts needs to publish.
let pathtoPublish: string = tl.getPathInput('PathtoPublish', true, true);
let artifactName: string = tl.getInput('ArtifactName', true);
let artifactType: string = tl.getInput('ArtifactType', true);

artifactType = artifactType.toLowerCase();

try {
    let data = {
        artifacttype: artifactType,
        artifactname: artifactName
    };

    // upload or copy
    if (artifactType === "container") {
        data["containerfolder"] = artifactName;
            
        // add localpath to ##vso command's properties for back compat of old Xplat agent
        data["localpath"] = pathtoPublish;
        tl.command("artifact.upload", data, pathtoPublish);
    }
    else if (artifactType === "filepath") {
        let targetPath: string = tl.getInput('TargetPath', true);
        let artifactPath: string = path.join(targetPath, artifactName);
        tl.mkdirP(artifactPath);

        if (os.platform() == 'win32') {
            let robocopy: tr.ToolRunner = new tr.ToolRunner('robocopy');
            robocopy.arg('/E'); // copy subdirectories, including Empty ones.
            robocopy.arg('/NP'); // No Progress - don't display percentage copied.
            robocopy.arg('/R:3'); // number of Retries on failed copies
            robocopy.arg(pathtoPublish); // source
            robocopy.arg(artifactPath); // destination
            robocopy.arg('*'); // file
            let result: tr.IExecResult = robocopy.execSync();
            if (result.code >= 8) {
                tl.setResult(tl.TaskResult.Failed, tl.loc('RobocopyFailed', result.code))
            }
        }
        else {
            console.log(tl.loc('SkippingCopy')); // add fwlink to message
            if (!artifactPath.startsWith('\\\\') || artifactPath.length < 3) {
                console.log(tl.loc('UncPathRequired'));
            }

            // add artifactlocation to ##vso command's properties for back compat of old Xplat agent
            data['artifactlocation'] = targetPath;
        }

        tl.command("artifact.associate", data, targetPath);
    }
}
catch (err) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('PublishBuildArtifactsFailed', err.message));
}