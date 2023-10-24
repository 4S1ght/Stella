
import { Soybean } from 'soybean'
import h from 'soybean/handlers'
import yaml, { YAMLException } from 'js-yaml'
import https from 'https'

// ==================================================================

const schema = new yaml.DEFAULT_SCHEMA.extend([
    new yaml.Type('!alpha', {
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
        https.get('https://code.visualstudio.com/api/references/theme-color', res => {
            let body = ''
            res.setEncoding('utf8')
            res.on('data', data => (body += data))
            res.on('end', () => resolve(body))
            res.on('error', reject)
        })
    }))

    const matches = response.match(new RegExp('<code>.+?</code>', 'g'))

    docsKeys = [...matches]
        .map(key => key.replace('<code>', '').replace('</code>', ''))
        .filter(key => !/ /.test(key))                 // Remove if contains spaces
        .filter(key => !/#.../.test(key))              // Remove if is a hex color
        .filter(key => !/&quot;/.test(key))            // Remove if contains quotes
        .filter(key => key.length > 4)                 // Remove if it's very small
        .filter(key => !blacklistedKeys.includes(key)) // Remove if its in the blacklist
        .sort()     
        
    return docsKeys
}

let docsKeys
let lintScope = ""

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

                    h.fs.readFile('./src/{{filename}}', 'yamlFile', 'utf-8'),
                    h.update('yamlFile', data => yaml.load(data), { schema }),

                    h.json.stringify('yamlFile', 'jsonFile', 4),
                    h.update('filename', name => name.split('.')[0] + '.json'),
                    
                    h.fs.writeFile('./themes/{{filename}}', Symbol('jsonFile')),

                    // ============= LINTING =============

                    h.handle(async e => {
                        e.set('docsKeys', await getDocsKeys())
                    }),
                    h.forIn(Symbol('yamlFile'), h.handle(e => {
                        const key = e.get('key')
                        if (!docsKeys.includes(key) && key.indexOf(lintScope) === 0) console.warn(`Unsupported key \x1b[31m${key}\x1b[0m`)
                    })),
                    h.forEach(Symbol('docsKeys'), h.handle(e => {
                        const value = e.get('value')
                        const theme = e.get('yamlFile')
                        if (!Object.keys(theme.colors || []).includes(value) && value.indexOf(lintScope) === 0) console.warn(`Missing key \x1b[34m${value}\x1b[0m`) 
                    }))

                ])
            }
        ]
    },
    terminal: {
        passthroughShell: false,
        keepHistory: 50,
        handlers: {
            scope: h.handle(e => { lintScope = e.get('argv')[0] || "" })
        }
    }
})