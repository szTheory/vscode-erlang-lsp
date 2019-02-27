import { window, workspace, Uri } from 'vscode'
import * as child_process from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as which from 'which'


const expandHomeDir = require('expand-home-dir')
const denodeify = require('denodeify')
const execFile = require('child-process-promise').execFile;

const isWindows = process.platform.indexOf('win') === 0
const ERL_FILENAME = 'erl' + (isWindows ? '.exe' : '')
const ESCRIPT_FILENAME = 'escript' + (isWindows ? '.exe' : '')

export interface RuntimeInfo {
    location: string
    ertsVersion: number
}

export async function getRuntimeInfo(): Promise<RuntimeInfo> {
    let location = await checkErlangLocation()
    if (location !== undefined) {
        let version = await checkErlangVersion(location)
        window.setStatusBarMessage('Using Erlang ' + (version + 11) + ' from ' + location, 10000)
        return { 'location': location, 'ertsVersion': version }
    }
    return { 'location': '', 'ertsVersion': 0 }
}

async function checkErlangLocation(): Promise<string> {
    let location: string = readErlangConfigLocation()
    if (location) {
        location = expandHomeDir(location)
        if (fs.existsSync(path.join(location, ESCRIPT_FILENAME))) {
            return location
        } else {
            if (fs.existsSync(path.join(location, 'bin', ESCRIPT_FILENAME))) {
                return path.join(location, 'bin')
            } else {
                window.showInformationMessage('Please review setting erlang.runtime.location: escript binary not found; trying $PATH')
            }
        }
    }
    let home = findErlangHome()
    return home
}

function readErlangConfigLocation(): string {
    const config = workspace.getConfiguration()
    return config.get<string>('erlang.runtime.location', '')
}

async function checkErlangVersion(erl_home: string): Promise<number> {
    let cp = await execFile(path.join(erl_home, 'erl'), ['-version'], { capture: ['stdout', 'stderr'] })
    let ver = cp.stderr.match('version ([0-9]+).')
    if (ver.length > 1) {
        let vv = parseInt(ver[1])
        if (vv >= 9) {
            return vv
        } else {
            throw Error('Erlang v' + (vv + 11) + ' found (need 20+).')
        }
    }
    return -1;
}

function findErlangHome(): string {
    let dir = which.sync('escript', { nothrow: true })
    if (dir === null) {
        return ''
    } else {
        return path.dirname(dir)
    }
}

function getOtpVersion(home: string) {
    let fname = path.join(home, 'start.script')
    if (fs.existsSync(fname)) {
        let v = fs.readFileSync(fname, 'utf-8')
        let x = v.match('{"Erlang/OTP", *"([^"]+)"}')
        if (x !== null && x.length === 2) {
            return x[1]
        }
    }
    return null
}
