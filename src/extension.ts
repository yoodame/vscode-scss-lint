// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
import {
    window,
    commands,
    workspace,
    Disposable,
    ExtensionContext,
    StatusBarAlignment,
    StatusBarItem,
    TextDocument,
    Range,
    DecorationOptions,
    OverviewRulerLane,
} from 'vscode';

let exec = require('child_process').exec;
let backgroundColor = 'rgba(200, 0, 0, .8)';

const errorDecorationType = window.createTextEditorDecorationType({
    backgroundColor,
    overviewRulerColor: backgroundColor,
    overviewRulerLane: 2,
});

// This method is called when your extension is activated. Activation is
// controlled by the activation events defined in package.json.
export function activate(context: ExtensionContext) {

    // create a new error finder
    let errorFinder = new ErrorFinder();
    let controller = new ErrorFinderController(errorFinder);

    // Add to a list of disposables which are disposed when this extension is deactivated.
    context.subscriptions.push(controller);
    context.subscriptions.push(errorFinder);
}

class ErrorFinder {

    private _statusBarItem: StatusBarItem;

    public finderErrors() {

        // Create as needed
        if (!this._statusBarItem) {
            this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
        }

        // Get the current text editor
        let editor = window.activeTextEditor;
        if (!editor) {
            this._statusBarItem.hide();
            return;
        }

        let doc = editor.document;

        // Only find errors if doc is an scss file
        if (doc.languageId === "scss") {
            const dir = (workspace.rootPath || '') + '/';
            const fileName = doc.fileName.replace(dir, '');
            const cmd = `cd ${dir} && scss-lint --no-color ${fileName}`;

            exec(cmd, (err, stdout) => {
                const activeEditor = window.activeTextEditor;
                const lines = stdout.toString().split('\n');
                const errors: DecorationOptions[] = lines.map(line => {
                    if(~line.indexOf('[E]')) {
                        const info = line.match(/[^:]*:(\d+):(\d+) \[E\] (.*)$/);
                        const lineNum = parseInt(info[1], 10) - 1;
                        const startPos = parseInt(info[2], 10) - 1;
                        const hoverMessage = info[3];
                        return { range: new Range(lineNum, startPos, lineNum + 1, 0), hoverMessage };
                    }
                }).filter(x => x);

                activeEditor.setDecorations(errorDecorationType, errors);

                // Update the status bar
                this._statusBarItem.text = `$(telescope) ${errors.length} scss-lint error${errors.length === 1 ? '' : 's'}`;
                this._statusBarItem.show();
            });
        } else {
            this._statusBarItem.hide();
        }
    }

    dispose() {
        this._statusBarItem.dispose();
    }
}

class ErrorFinderController {

    private _errorFinder: ErrorFinder;
    private _disposable: Disposable;

    constructor(errorFinder: ErrorFinder) {
        this._errorFinder = errorFinder;
        this._errorFinder.finderErrors();

        // subscribe to selection change and editor activation events
        let subscriptions: Disposable[] = [];
        workspace.onDidSaveTextDocument(this._onEvent, this, subscriptions);
        window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);

        // update the error finder for the current file
        this._errorFinder.finderErrors();

        // create a combined disposable from both event subscriptions
        this._disposable = Disposable.from(...subscriptions);
    }

    dispose() {
        this._disposable.dispose();
    }

    private _onEvent() {
        this._errorFinder.finderErrors();
    }
}
