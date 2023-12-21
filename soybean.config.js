
import { Soybean, handlers as h } from 'soybean'
import yaml from 'js-yaml'
import c from 'chalk'

// ==================================================================

const docsPage = 'https://code.visualstudio.com/api/references/theme-color'

const mixHexCodes = (p, c1, c2) => {
    c1 = c1.replace('#', '').match(/.{1,2}/g)
    c2 = c2.replace('#', '').match(/.{1,2}/g)
    let c3 = '#'
    for (let i = 0; i < c1.length; i++) {
        const h1 = parseInt(c1[i], 16)
        const h2 = parseInt(c2[i], 16)
        c3 += parseInt(h1 + ((h2 - h1) * p)).toString(16)
    }
    return c3
}

const schema = new yaml.DEFAULT_SCHEMA.extend([
    new yaml.Type('!a', {
        kind: 'sequence',
        construct: ([hexRGB, alpha]) => hexRGB + alpha,
        represent: ([hexRGB, alpha]) => hexRGB + alpha,
    }),
    new yaml.Type('!mix', {
        kind: 'sequence',
        construct: ([h1, h2, p]) => mixHexCodes(p, h1, h2),
        represent: ([h1, h2, p]) => mixHexCodes(p, h1, h2),
    }),
    new yaml.Type('!v', {
        kind: 'sequence',
        construct: ([v]) => v,
        represent: ([v]) => v,
    })
])

// ==================================================================

const parse = h.group([
    h.fs.readdir('./src/', 'sources'),
    h.fs.readFile('./props.yaml', 'props', 'utf-8'),
    h.forEach(Symbol('sources'), h.group([
        h.fs.readFile('./src/{{value}}', 'vars', 'utf-8'),
        h.handle(e => {
            const text = e.vars.replace('%props%', e.props)
            const theme = yaml.load(text, { schema })
            for (const key in theme.colors) if (!theme.colors[key]) delete theme.colors[key]
            e.set('theme', theme)
        }),
        h.json.stringify('theme', null, 4),
        h.update('value', name => name.split('.')[0] + '.json'),
        h.fs.writeFile('./themes/{{value}}', Symbol('theme')),
    ]))
])

export default Soybean({
    cp: {},
    routines: {
        launch: [
            h.fs.mkdir('./themes', { recursive: true }),
        ],
        watch: [
            { handle: parse, file: './src' },
            { handle: parse, file: './props.yaml' }
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
                const c1 = `${c.gray(t)}${c.whiteBright(t)}${c.greenBright(t)}${c.cyanBright(t)}${c.blueBright(t)}${c.magentaBright(t)}${c.redBright(t)}${c.yellowBright(t)}`
                const c2 = `${c.black(t)}${c.white(t)}${c.green(t)}${c.cyan(t)}${c.blue(t)}${c.magenta(t)}${c.red(t)}${c.yellow(t)}`
                const c3 = `${c.bgGray(b)}${c.bgWhiteBright(b)}${c.bgGreenBright(b)}${c.bgCyanBright(b)}${c.bgBlueBright(b)}${c.bgMagentaBright(b)}${c.bgRedBright(b)}${c.bgYellowBright(b)}`
                const c4 = `${c.bgBlack(b)}${c.bgWhite(b)}${c.bgGreen(b)}${c.bgCyan(b)}${c.bgBlue(b)}${c.bgMagenta(b)}${c.bgRed(b)}${c.bgYellow(b)}`
                
                console.log(c1)
                console.log(c2)
                console.log(c3)
                console.log(c4)

            })
        }
    }
})