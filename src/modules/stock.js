const CacheData = require('../utils/cache');
const { parseMsg, parseDate } = require('../utils/index');
const xueqiu = require('../sites/xueqiu');
const { activeRooms } = require('../config');
const roomCacheData = new CacheData();
const { RegType } = require('../contants');

const debugFlag = true;

/**
 * 股票消息处理
 * @param {*} message
 */

async function message(message) {
  try {
    const room = message.room();
    const from = message.talker();
    const text = message.text().replace(RegType.stock, '');
    const sayer = room || message;
    /* if (room || debugFlag) {
    const topic = await room.topic();
    if (activeRooms.indexOf(topic) >= 0 || debugFlag) {
      const roomKey = `_ROOM_${room.id}`;
      if (!roomCacheData.get(roomKey)) {
        roomKeys.push(roomKey);
        roomCacheData.add(roomKey, room);
      } */
    // 大盘
    const overviewCodes = [
      'SH000001',
      'SH000300',
      'SZ399001',
      'SZ399006',
      'SH000688',
    ];
    const [names, codes] = parseMsg(text, true);
    let symbol = '';
    if (codes.length > 0) {
      symbol = codes.join(',');
    } else if (text.indexOf('大盘') >= 0 || text.indexOf('指数') >= 0) {
      symbol = overviewCodes.join(',');
    }
    if (symbol) {
      xueqiu.quote(symbol).then((res) => {
        const { items } = res?.data || {};
        const msg = xueqiu.batchQuoteResp(items);
        if (!msg) return;
        sayer.say(msg);
      });
    }
    if (text.indexOf('龙虎榜') >= 0) {
      const date = parseDate(text);
      console.log(date);
      xueqiu.longhu(date).then((res) => {
        const data = res?.data;
        if (!data) {
          return;
        }
        const msg = xueqiu.longhuRes(data, date);
        if (!msg) return;
        sayer.say(msg);
      });
    }
    /*   }
    console.log(`Message: ${room}, ${from.name()}, ${text}`);
  } */
  } catch (err) {
    console.log(err);
  }
}

module.exports = message;