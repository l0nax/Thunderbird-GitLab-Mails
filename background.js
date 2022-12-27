browser.messages.onUpdated.addListener(function(msg, props) {
    handleMessage(msg.folder, {
        messages: [msg],
    });
});
browser.messages.onNewMailReceived.addListener(handleMessage);

function isKnownPath(header) {
    // NOTE: Project path MUST be checked before group-path header!
    // This is because we support epics and the Group_path header is present
    // in project emails too.
    const knownHeaders = [
        "x-gitlab-project-path",
        "x-gitlab-group-path",
    ];

    for (const h of knownHeaders) {
        if (h === header) return true;
    }

    return false;
}

function handleMessage(folder, msgList) {
    console.log("Got new message", { folder, msgList });
    if (folder.type !== "inbox") {
        return;
    }

    for (let msg of msgList.messages) {
        if (msg.junk) continue;

        // get account
        browser.accounts.get(folder.accountId).then((account) => {
            // get full message
            browser.messages.getFull(msg.id).then((full) => {
                console.log("Got full [typeof]", typeof (full.headers));
                console.log("Headers", full.headers);

                for (const k in full.headers) {
                    if (!isKnownPath(k)) continue;

                    const prjPath = full.headers[k];
                    console.log("Moving msg to folder", { target: `Prjs/${prjPath}` });
                    createAndMove(account, `Prjs/${prjPath}`, msg.id);
                }
            });
        });
    }
}

async function createAndMove(account, directory, msgID) {
    let parent = account;
    for (const folder of directory.split('/')) {
        try {
            const p = await browser.folders.create(parent, folder);
            parent = p;
        } catch (e) {
            // ignore => folder already exists, instead get all sub-folders
            // and find the last existing folder
            // TODO(eb): Improve this!!!
            const folders = await browser.folders.getSubFolders(parent, true);
            for (const f of folders) {
                if (f.name !== folder) continue;
                parent = f;

                break;
            }
        }
    }

    console.log("Folder(s) created!");

    browser.messages.move([msgID], parent);
}
