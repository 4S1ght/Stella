
import { Soybean } from 'soybean'
import h from 'soybean/handlers'
import yaml from 'js-yaml'
import https from 'https'
import c from 'chalk'

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

                    h.handle(e => {
                        for (const key in e.yamlFile.colors) 
                            if (!e.yamlFile.colors[key]) delete e.yamlFile.colors[key]
                    }),

                    h.json.stringify('yamlFile', 'jsonFile', 4),
                    h.update('filename', name => name.split('.')[0] + '.json'),
                    
                    h.fs.writeFile('./themes/{{filename}}', Symbol('jsonFile')),

                    // ============= LINTING =============
                    h.set('keys', 0),
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
                            e.update('keys', k => k+1)
                        }
                    })),
                    h.handle(e => console.log(`Missing keys: ${e.keys} (scope: ${lintScope || '?'})`)),
                ])
            }
        ]
    },
    terminal: {
        passthroughShell: true,
        keepHistory: 50,
        handlers: {
            scope: h.handle(e => { lintScope = e.argv[0] || "" }),
            docs: h.shell.spawn(['open', docsPage]),
            colors: h.handle(e => {
                const b = '   '
                const t = 'Abc'
                const c1 = `${c.black(t)}${c.whiteBright(t)}${c.greenBright(t)}${c.cyanBright(t)}${c.blueBright(t)}${c.magentaBright(t)}${c.redBright(t)}${c.yellowBright(t)}`
                const c2 = `${c.gray(t)}${c.white(t)}${c.green(t)}${c.cyan(t)}${c.blue(t)}${c.magenta(t)}${c.red(t)}${c.yellow(t)}`
                const c3 = `${c.bgBlack(b)}${c.bgWhiteBright(b)}${c.bgGreenBright(b)}${c.bgCyanBright(b)}${c.bgBlueBright(b)}${c.bgMagentaBright(b)}${c.bgRedBright(b)}${c.bgYellowBright(b)}`
                const c4 = `${c.bgGray(b)}${c.bgWhite(b)}${c.bgGreen(b)}${c.bgCyan(b)}${c.bgBlue(b)}${c.bgMagenta(b)}${c.bgRed(b)}${c.bgYellow(b)}`
                
                console.log(c1)
                console.log(c2)
                console.log(c3)
                console.log(c4)

            })
        }
    }
})