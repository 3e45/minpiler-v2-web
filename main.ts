import type * as monacoType from "monaco-editor"
// @ts-ignore
import * as monaco_ from 'monaco-editor/esm/vs/editor/editor.main.js'
const monaco = monaco_ as typeof monacoType

self.MonacoEnvironment = {
    getWorkerUrl: function (moduleId, label) {
        switch (label) {
            case "json": return './dist/vs/language/json/json.worker.js'
            case 'css': case 'scss': case 'less': return './dist/vs/language/css/css.worker.js'
            case 'html': case 'handlebars': case 'razor': return './dist/vs/language/html/html.worker.js'
            case 'typescript': case 'javascript': return './dist/vs/language/typescript/ts.worker.js'
            default: return './dist/vs/editor/editor.worker.js'
        }
    }
}

const { CompletionItemKind } = monaco.languages

monaco.languages.registerCompletionItemProvider("python", {
    provideCompletionItems(model, position, context, token) {
        const item = (label: string, kind: number) => ({ label, kind, range: new monaco.Range(position.lineNumber, word?.startColumn ?? position.column, position.lineNumber, word?.endColumn ?? position.column), insertText: label })
        const word = model.getWordAtPosition(position)
        const line = model.getLineContent(position.lineNumber)
        const suggestions: ReturnType<typeof item>[] = []
        const textBeforeCursor = line.slice(0, position.column - 1)
        if (/\bM\.$/.test(textBeforeCursor)) {
            suggestions.push(item("print", CompletionItemKind.Function), item("print_flush", CompletionItemKind.Function))
        } else if (/^$|[^a-z\.]$/i.test(textBeforeCursor)) {
            suggestions.push(item("M", CompletionItemKind.Module), item("L", CompletionItemKind.Module))
        }
        return { suggestions }
    },
    triggerCharacters: ["."],
})

const editor = monaco.editor.create(document.getElementById('input')!, {
    value: `\
from minpiler.std import M, L, asm

M.print(f"1 + 2 = {1 + 2}")
M.print_flush(L.message1)

for i in range(M.at.const.links):
    link = M.get_link(i)
    M.control.set_enabled(link, link.heat == 0)
`,
    language: 'python'
})

// @ts-ignore
window.editor = editor

const println = (message: string) => {
    document.querySelector<HTMLElement>("#stderr")!.innerText += message + "\n"
}

async function main() {
    println("Loading Python...")
    const pyodide = await (globalThis as any).loadPyodide()

    println("Loading pip...")
    await pyodide.loadPackage("micropip")
    const micropip = pyodide.pyimport("micropip")

    println("Installing networkx...")
    await micropip.install('networkx')

    println("Downloading minpiler...")
    // zip -r minpiler.zip minpiler
    await pyodide.unpackArchive(await (await fetch("./minpiler.zip")).arrayBuffer(), "zip")

    println("Loading minpiler...")
    pyodide.runPython(`
from minpiler import compiler, optimizer
from pathlib import Path
`)
    println("Done")
    document.querySelector<HTMLElement>("#loading")!.style.display = "none"

    document.querySelector<HTMLElement>("#compile")!.removeAttribute("disabled")
    document.querySelector<HTMLElement>("#compile")!.addEventListener("click", () => {
        document.querySelector<HTMLElement>("#loading")!.style.display = "block"
        try {
            document.querySelector<HTMLTextAreaElement>("#output")!.value = pyodide.runPython(`
from minpiler import compiler, optimizer
from pathlib import Path

try:
result = str(compiler.build(${JSON.stringify(editor.getValue())}, Path("main.py"), use_emulator_instructions=False, optimize=optimizer.optimize))
except Exception as e:
result = str(e)

result
`)
        } finally {
            document.querySelector<HTMLElement>("#loading")!.style.display = "none"
        }
    })
}
// main()
