/*--------------------------------------------------------------
 *  Copyright (c) Nickbing Lao<giscafer@outlook.com>. All rights reserved.
 *  Licensed under the MIT License.
 *-------------------------------------------------------------*/

// polyfill
require('./utils/polyfill');
// middleware
// const Wechat = require('wechat4u');
const { Wechaty, config } = require('wechaty');
const request = require('request');
const qrTerm = require('qrcode-terminal');
const fs = require('fs');
const { FileBox } = require('file-box');

// utils
const _ = require('./utils/util');
const imgUtil = require('./utils/image');
const { RegType } = require('./contants');
const { activeRooms } = require('./config');

// modules
// const poetry = require('./modules/poetry'); // 需要测试诗词的放开这个注释即可
const getPicture = require('./modules/searchPic');
const getTyphoonInfo = require('./modules/typhoon.js');
const translate = require('./modules/translate');
const ip = require('./modules/ip');
const weather = require('./modules/weather');
const keyword = require('./modules/keyword');
const jobs = require('./modules/jobs');
const stockMsgHandler = require('./modules/stock');

let bot, loginUserName;
// ocr启用状态
let ocrOn = false;
let contactUsers = [];

// 尝试获取本地登录数据，免扫码
try {
  bot = new Wechaty();
  // bot = new Wechat(require('./sync-data.json'));
} catch (e) {
  console.log(e);
  // bot = new Wechat();
}
/**服务心跳检查（发送到微信文件助手） */
/* bot.setPollingIntervalGetter(() => {
  return 2 * 60 * 1000;
}); */

/* if (bot.PROP.uin) {
  bot.restart();
} else {
  bot.start();
} */

// 生成二维码
/* bot.on('uuid', (uuid) => {
  qrcode.generate('https://login.weixin.qq.com/l/' + uuid, {
    small: true,
  });
  // console.log('二维码链接：', 'https://login.weixin.qq.com/qrcode/' + uuid);
}); */
bot.on('scan', onScan);
bot.on('error', onError);

// 登录成功
bot.on('login', (user) => {
  loginUserName = user.name();
  console.log(`${loginUserName} login`);
  // fs.writeFileSync('./sync-data.json', JSON.stringify(user));
});

// 登出成功
bot.on('logout', () => {
  console.log(`${user.name()} logouted`);
  fs.unlinkSync('./sync-data.json');
});

bot.on('contacts-updated', (contacts) => {
  if (contactUsers.length < activeRooms) {
    console.log('contacts-updated');
    for (const name of activeRooms) {
      let user = bot.Contact.getSearchUser('幸福里1')[0].UserName;
      addUserList(user);
      console.log(`获取目标用户[${name}]成功: `, user);
    }
  }
});

/**监听信息发送 */
bot.on('message', async (msg) => {
  const MessageType = msg.type();
  const room = msg.room();
  const talker = msg.talker();
  // 只在指定群里生效
  if (talker?.name !== 'Nickbing Lao') {
    if (room) {
      const topic = await room.topic();
      if (activeRooms.indexOf(topic) === -1) {
        return;
      }
    }
  }

  switch (MessageType) {
    case bot.Message.Type.Contact:
      break;
    case bot.Message.Type.Text:
      // console.log(msg);
      textMsgHandler(msg);
      break;
    case bot.Message.Type.Unknown:
      break;
    case bot.Message.Type.Image:
      if (ocrOn) {
        bot.getMsgImg(msg.MsgId).then((res) => {
          let image = res.data.toString('base64');
          _.ocr(image).then((result) => {
            sendText(result, msg);
          });
        });
      }
      break;
  }
});

bot.start().catch(async (e) => {
  console.error('Bot start() fail:', e);
  await bot.stop();
  process.exit(-1);
});

/**
 *
 * 5. Define Event Handler Functions for:
 *  `scan`, `login`, `logout`, `error`, and `message`
 *
 */
function onScan(qrcode, status) {
  qrTerm.generate(qrcode, { small: true });

  // Generate a QR Code online via
  // http://goqr.me/api/doc/create-qr-code/
  const qrcodeImageUrl = [
    'https://wechaty.js.org/qrcode/',
    encodeURIComponent(qrcode),
  ].join('');

  console.log(`[${status}] ${qrcodeImageUrl}\nScan QR Code above to log in: `);
}

function onError(e) {
  console.error('Bot error:', e);
  /*
  if (bot.logonoff()) {
    bot.say('Wechaty error: ' + e.message).catch(console.error)
  }
  */
}

function sendText(text, msg) {
  console.log(`${msg.talker().name}：${text}`);
  if (!text) return;
  msg.say(text).catch(console.error);
}

/**文本信息识别 */
function textMsgHandler(msg) {
  let room = msg.room();
  let talker = msg.talker();
  let text = msg.text();
  if (!text) return;
  let index = text.indexOf('\n');
  if (index !== -1) {
    text = text.substr(index + 1, text.length);
  }
  text = text.trim();
  // 图片搜索
  if (text.indexOf('图 ') === 0) {
    msg.say('随机图片搜索中……');
    const keyword = text.replace('图', '').replace('图片', '').trim();
    getPicture(keyword)
      .then((url) => {
        if (url) {
          console.log(url);
          let imgUrl = imgUtil.getImageUrl(url);
          if (!imgUrl) {
            msg.say('搜索的图片解析失败：' + url);
            return;
          }
          try {
            const fileBox = FileBox.fromUrl(imgUrl);
            msg.say(fileBox);
          } catch (err) {
            msg.say('图片发送错误：' + imgUrl);
            console.log('图片发送错误', err);
          }
        } else {
          msg.say(`无相关[${keyword}]图片!`);
        }
      })
      .catch((err) => {
        console.log(err);
      });
  }
  // 台风查询
  else if (text.indexOf('查台风') === 0) {
    getTyphoonInfo()
      .then((text) => {
        text = text || '当前没有台风！';
        sendText(text, msg);
      })
      .catch((err) => {
        sendText('台风查询失败', msg);
      });
  }
  // 词典翻译
  else if (_.isTranslate(text)) {
    let _text = _.getTransText(text);
    translate(
      Object.assign(
        {
          from: 'en',
          to: 'zh',
          query: _text,
        },
        _.transTarget(text),
      ),
      (result) => {
        sendText(result, msg);
      },
    );
  }
  // ip归属地信息
  else if (_.isIpQuery(text)) {
    let ipStr = _.getIP(text);
    // console.log(ipStr)
    ip(ipStr)
      .then((result) => {
        sendText(result, msg);
      })
      .catch((err) => {
        sendText('ip查询失败', msg);
      });
  }
  // 天气信息
  else if (_.isWeatherQuery(text)) {
    let cityName = _.getCity(text);
    weather(cityName)
      .then((result) => {
        sendText(result, msg);
      })
      .catch((err) => {
        sendText('天气查询失败', msg);
      });
  }
  // 唐诗宋词查询
  else if (_.isPoetry(text)) {
    sendText('已关闭该功能', msg);
    /*  let result = poetry(text);
    if (result) {
      sendText(result, msg);
    } */
  }
  // 查招聘行情
  else if (_.isFindJobs(text)) {
    jobs().then((result) => {
      sendText(result, msg);
    });
  }
  // 助手介绍信息
  else if (_.replyIntro(text)) {
    let result = _.introInfo();
    sendText(result, msg);
  }
  // 关键词设定自动回复
  else if (text.startsWith('查') || text.startsWith('query')) {
    let result = keyword(text);
    if (result) {
      sendText(result, msg);
    }
  }
  // ocr
  else if (text.trim() === 'open easyocr') {
    sendText('需要管理员启用OCR！', msg);
  }
  // 本人同意开启ocr
  else if (
    text.startsWith('open easyocr confirm') &&
    msg.FromUserName === loginUserName
  ) {
    ocrOn = true;
    sendText('OCR 已开启（免费使用QPS不能大于2）', msg);
  }
  // 关闭 ocr
  else if (
    text.startsWith('close easyocr') &&
    msg.FromUserName === loginUserName
  ) {
    ocrOn = false;
    sendText('OCR 已关闭', msg);
  } else if (RegType.stock.test(text)) {
    stockMsgHandler(msg);
  }
}