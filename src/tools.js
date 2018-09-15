import _ from 'lodash'
import state from '@/state.js'
import murmurhash from 'murmurhash'
import Tweezer from 'tweezer.js'
import Vue from 'vue'
import api from './netapi.js'
import ws from './ws.js'
import Color from 'color'

let messageId = 1
let scroller = null

$.scrollTo = function (el) {
    if (scroller) scroller.stop()
    scroller = new Tweezer({
        start: window.pageYOffset,
        end: el.getBoundingClientRect().top + window.pageYOffset,
        duration: 500
    })
        .on('tick', v => window.scrollTo(0, v))
        .on('done', () => {
            scroller = null
        })
        .begin()
}

$.timeout = function (delay) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve()
        }, delay)
    })
}

$.dateFormat = function (d, format) {
    var date, k
    date = {
        'M+': d.getMonth() + 1,
        'd+': d.getDate(),
        'h+': d.getHours(),
        'm+': d.getMinutes(),
        's+': d.getSeconds(),
        'q+': Math.floor((d.getMonth() + 3) / 3),
        'S+': d.getMilliseconds()
    }
    if (/(y+)/i.test(format)) {
        format = format.replace(RegExp.$1, (d.getFullYear() + '').substr(4 - RegExp.$1.length))
    }
    for (k in date) {
        if (new RegExp('(' + k + ')').test(format)) {
            format = format.replace(RegExp.$1, RegExp.$1.length === 1 ? date[k] : ('00' + date[k]).substr(('' + date[k]).length))
        }
    }
    return format
}

/**
 * Deep diff between two object, using lodash
 * @param  {Object} object Object compared
 * @param  {Object} base   Object to compare with
 * @return {Object}        Return a new object who represent the diff
 */
$.objDiff = function (object, base) {
    let changes = function (object, base) {
        return _.transform(object, (result, value, key) => {
            if (!_.isEqual(value, base[key])) {
                result[key] = (_.isObject(value) && _.isObject(base[key])) ? changes(value, base[key]) : value
            }
        })
    }
    return changes(object, base)
}

let notifSign = false

$.isAdmin = function () {
    return (state.user) && (state.user.group >= state.misc.USER_GROUP.ADMIN)
}

$.notifLoopOn = async () => {
    let fetchNotif = async () => {
        if (ws.conn) return
        if (state.user) {
            let ret = await api.notif.refresh()
            if (ret.code === api.retcode.SUCCESS) {
                if (ret.data) {
                    Vue.set(state, 'unread', ret.data)
                }
            }
        }
    }

    if (!notifSign) {
        setInterval(fetchNotif, 15000)
        notifSign = true
    }

    await fetchNotif()
}

$.media = {
    xs: {maxWidth: '35.5em'},
    sm: {minWidth: '35.5em'},
    md: {minWidth: '48em'},
    lg: {minWidth: '64em'},
    xl: {minWidth: '80em'}
}

$.dataURItoBlob = function (dataURI) {
    // convert base64 to raw binary data held in a string
    // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
    var byteString = atob(dataURI.split(',')[1])

    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

    // write the bytes of the string to an ArrayBuffer
    var ab = new ArrayBuffer(byteString.length)
    var ia = new Uint8Array(ab)
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i)
    }

    return new Blob([ab], {type: mimeString})
}

let uploadKeyTime = 0
let uploadToken = ''

$.staticUrl = function (key) {
    return `${state.misc.BACKEND_CONFIG.UPLOAD_STATIC_HOST}/${key}`
}

$.asyncGetUploadToken = async function (isAvatarUpload = false) {
    if (isAvatarUpload) {
        let ret = await api.upload.token('user', isAvatarUpload)
        if (ret.code === api.retcode.SUCCESS) {
            return ret.data
        }
        return null
    }

    let offset = state.misc.BACKEND_CONFIG.UPLOAD_QINIU_DEADLINE_OFFSET - 2 * 60
    let now = Date.parse(new Date()) / 1000
    // 若 token 的有效时间降至，那么申请一个新的（2min余量）
    if ((now - uploadKeyTime) > offset) {
        let ret = await api.upload.token('user')
        if (ret.code === api.retcode.SUCCESS) {
            uploadKeyTime = now
            uploadToken = ret.data
        } else {
            // 异常情况
            return null
        }
    }
    return uploadToken
}

$.boardColor = function (board) {
    if (board.color) {
        try {
            return Color(board.color).string()
        } catch (error) {
            try {
                let c = '#' + board.color
                return Color(c).string()
            } catch (error) {}
        }
    }
    let bgColor = murmurhash.v3(board.name).toString(16).slice(0, 6)
    return '#' + bgColor
}

$.lineStyle = function (board, key = 'border-left-color') {
    return { [key]: $.boardColor(board) }
}

$.lineStyleById = function (boardId, key = 'border-left-color') {
    let exInfo = $.getBoardExInfoById(boardId)
    if (exInfo) {
        return { [key]: exInfo.color }
    }
    return {}
}

$.message = function (type, text, timeout = 3000) {
    // type: default, secondary, success, warning, error
    let convert = {
        'default': '',
        'secondary': 'am-alert-secondary',
        'success': 'am-alert-success',
        'warning': 'am-alert-warning',
        'error': 'am-alert-danger'
    }
    let data = {type, text, class: convert[type], id: messageId++}
    state.msgs.push(data)
    _.delay(() => {
        state.msgs.splice(state.msgs.indexOf(data), 1)
    }, timeout)
}

$.message_text = function (text, timeout = 3000) {
    $.message('default', text, timeout) // 蓝色
}

$.message_secondary = function (text, timeout = 3000) {
    $.message('secondary', text, timeout) // 灰色白字，很不明显
}

$.message_success = function (text, timeout = 3000) {
    $.message('success', text, timeout) // 绿色
}

$.message_warning = function (text, timeout = 3000) {
    $.message('warning', text, timeout) // 黄色
}

$.message_error = function (text, timeout = 3000) {
    $.message('error', text, timeout) // 红色
}

$.message_by_code = function (code, text = null, timeout = 3000) {
    text = text || state.misc.retinfo_cn[code]
    if (code === state.misc.retcode.SUCCESS) $.message_success(text, timeout)
    else $.message_error(text, timeout)
}

$.message_by_form = function (code, data, alias, timeout = 6000) {
    if (code) {
        for (let [k, errs] of Object.entries(data)) {
            for (let err of errs) {
                let name = alias[k] || k
                $.message_by_code(code, `${name}：${err}`, timeout)
            }
        }
    } else {
        $.message_by_code(code, timeout)
    }
}

$.tpReg = function (name, func) {
    state.test.items.push([name, func])
}

$.tpRemove = function () {
    ;
}

$.tpClear = function () {
    state.test.items = []
}

let fibMemo = {}
let levelExp = []
let levelAllExp = []

function fib (num, memo) {
    if (fibMemo[num]) return fibMemo[num]
    if (num <= 1) return 1

    fibMemo[num] = fib(num - 1, fibMemo) + fib(num - 2, fibMemo)
    return fibMemo[num]
}

$.getLevelExp = function (level) {
    if (level < 1) return { 'level': 0, 'all': 0 }
    level -= 1
    if (levelExp.length <= level) {
        for (let i = levelExp.length; i <= level; i++) {
            levelExp[i] = fib(i) * 100
            if (i > 0) {
                levelAllExp[i] = levelAllExp[i - 1] + levelExp[i]
            } else {
                levelAllExp[i] = levelExp[i]
            }
        }
    }
    return {
        'level': levelExp[level],
        'all': levelAllExp[level]
    }
}

$.getLevelByExp = function (exp) {
    for (let i = 1; ;i++) {
        let val = $.getLevelExp(i)
        if (exp < val.all || i === 255) {
            return {
                'cur': exp - $.getLevelExp(i - 1).all,
                'level': i,
                'exp': val
            }
        }
    }
}

$.regex = {
    id: /[a-fA-F0-9]+/,
    email: /^\w+((-\w+)|(\.\w+))*@[A-Za-z0-9]+((\.|-)[A-Za-z0-9]+)*\.[A-Za-z0-9]+$/,
    nickname: /^[\u4e00-\u9fa5a-zA-Z][\u4e00-\u9fa5a-zA-Z0-9]+$/
}

$.atConvert = function (text) {
    /* eslint-disable no-control-regex */
    return text.replace(/\x01([a-zA-Z0-9]+)-(.+?)\x01/g, '<a href="javascript:userPage(\'$1\', \'$2\')">@$2</a>')
}

$.atConvert2 = function (text) {
    /* eslint-disable no-control-regex */
    return text.replace(/\x01([a-zA-Z0-9]+)-(.+?)\x01/g, '@$2')
}

$.getBoardChainById = function (curBoardId, forceRefresh = false) {
    // 获取当前板块的所有父节点（包括自己）
    if (!state.boards.loaded) {
        return []
    }
    if (!forceRefresh) {
        let exi = state.boards.exInfoMap[curBoardId]
        if (exi) return exi.chain
        return []
    }
    let lst = [curBoardId]
    if (!curBoardId) return lst
    let infoMap = state.boards.infoMap
    if (!Object.keys(infoMap).length) return lst
    while (true) {
        let pid = infoMap[curBoardId].parent_id
        if (!pid) break
        lst.push(pid)
        curBoardId = pid
    }
    return lst
}

$.getBoardInfoById = function (id) {
    // 因为要在 computed 中使用，所以不能为 async
    // if (!state.boards.loaded) await $.getBoardsInfo()
    return state.boards.infoMap[id]
}

$.getBoardExInfoById = function (id) {
    // if (!state.boards.loaded) await $.getBoardsInfo()
    return state.boards.exInfoMap[id]
}

$.getBoardsInfo = async function (forceRefresh = false) {
    if (state.boards.loaded && (!forceRefresh)) return
    let boards = await api.board.list({
        order: 'parent_id.desc,weight.desc,time.asc' // 权重从高到低，时间从先到后
    })

    if (boards.code === api.retcode.SUCCESS) {
        let lst = []
        let infoMap = {}

        for (let i of boards.data.items) {
            let subboards = []
            for (let j of boards.data.items) {
                if (j.parent_id === i.id) subboards.push(j)
            }

            infoMap[i.id] = i
            if (!i.parent_id) {
                lst.push(i)
            }

            let color = $.boardColor(i)
            Vue.set(state.boards.exInfoMap, i.id, {
                'subboards': subboards,
                'color': color,
                // darken 10% when hover
                'colorHover': Color(color).darken(0.1).string()
            })
        }

        // Vue.set(state.boards, 'lst', lst)
        state.boards.lst = lst
        state.boards.rawLst = boards.data.items
        state.boards.infoMap = infoMap

        state.boards.loaded = true
        for (let i of boards.data.items) {
            state.boards.exInfoMap[i.id].chain = $.getBoardChainById(i.id, true)
        }
    }
}

window.userPage = function (uid, nickname) {
    console.log(uid, nickname)
}
