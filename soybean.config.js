
import { Soybean } from 'soybean'
import h from 'soybean/handlers'
import yaml from 'js-yaml'
import https from 'https'

// ==================================================================

const docsPage = 'https://code.visualstudio.com/api/references/theme-color'
let docsKeys
let lintScope = ""

const schema = new yaml.DEFAULT_SCHEMA.extend([
    new yaml.Type('!a', {
        kind: 'sequence',
        construct: ([hexRGB, alpha]) => hexRGB + alpha,
        represent: ([hexRGB, alpha]) => hexRGB + alpha,
    })
])

const getDocsKeys = async e => {

    if (docsKeys) return docsKeys

    /**
     * Function ported from Dracula theme repo
     * https://github.com/dracula/visual-studio-code
     */
    const blacklistedKeys = [ 'workbench.colorCustomizations', 'editor.tokenColorCustomizations', ]
    const response = await (new Promise((resolve, reject) => {
        https.get(docsPage, res => {
            let body = ''
            res.setEncoding('utf8')
            res.on('data', data => (body += data))
            res.on('end', () => resolve(body))
            res.on('error', reject)
        })
    }))

    const matches = response.match(new RegExp('<code>.+?</code>.+?</li>', 'g'))

    docsKeys = [...matches]
        .map(key => key.replace(/<code>|<\/code>|<\/li>/g, ''))
        .filter(key => key.includes(': '))             // Remove if doesn't contain ": "
        .map(key => key.split(': '))
        .filter(([key, desc]) => !/ /.test(key))                 // Remove if contains spaces
        .filter(([key, desc]) => !/#.../.test(key))              // Remove if is a hex color
        .filter(([key, desc]) => !/&quot;/.test(key))            // Remove if contains quotes
        .filter(([key, desc]) => key.length > 4)                 // Remove if it's very small
        .filter(([key, desc]) => !blacklistedKeys.includes(key)) // Remove if its in the blacklist  

    return docsKeys
}

// ==================================================================

export default Soybean({
    cp: {},
    routines: {
        launch: [
            h.fs.mkdir('./themes', { recursive: true }),
        ],
        watch: [
            {
                file: './src',
                handle: h.group([

                    // Don't react to events events that aren't a file save (like delete, rename, etc)
                    h.handle(e => e.watchEventType !== 'change' && e.stopPropagation()),

                    h.fs.readFile('./src/{{filename}}', 'yamlFile', 'utf-8'),
                    h.update('yamlFile', data => yaml.load(data, { schema })),

                    h.json.stringify('yamlFile', 'jsonFile', 4),
                    h.update('filename', name => name.split('.')[0] + '.json'),
                    
                    h.fs.writeFile('./themes/{{filename}}', Symbol('jsonFile')),

                    // ============= LINTING =============

                    h.handle(async e => {
                        e.set('docsKeys', await getDocsKeys())
                    }),
                    h.forIn(Symbol('yamlFile'), h.handle(e => {
                        if (!docsKeys.find(([key]) => key === e.key) && e.key.indexOf(lintScope) === 0) {
                            console.warn(`\x1b[31m${e.key}\x1b[0m`)
                        }
                    })),
                    h.forEach(Symbol('docsKeys'), h.handle(e => {
                        const [value, desc] = e.value
                        const theme = e.yamlFile
                        if (!Object.keys(theme.colors || []).find(x => x === value) && value.indexOf(lintScope) === 0) {
                            console.warn(`\x1b[34m${value}\x1b[0m: \x1b[30m${desc}\x1b[0m`)
                        }
                    }))
                ])
            }
        ]
    },
    terminal: {
        passthroughShell: true,
        keepHistory: 50,
        handlers: {
            scope: h.handle(e => { lintScope = e.argv[0] || "" }),
            docs: h.shell.spawn(['open', docsPage])
        }
    }
})