#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const axios = require('axios');
var xml2js = require('xml2js');
var xpath = require('xml2js-xpath');

const cwdPath = process.cwd();
const configPath = path.join(cwdPath, 'iconfont.json');

const init = async () => {
  try {
    await existsConfig(configPath);
    const data = require(configPath);
    const symbol = await axios.get(data.symbol_url);
    const obj = await parser(symbol.data);
    createSvg(obj.symbol, data.save_dir, data.excludes);
    createIndex(obj.symbol, data.save_dir);
  } catch (error) {
    throw error;
  }
};

function createSvg(symbols, dir, excludes) {
  if (!fs.existsSync(path.join(cwdPath, dir))) {
    fs.mkdirSync(path.join(cwdPath, dir));
  } else {
    const files = fs.readdirSync(path.join(cwdPath, dir));
    files.forEach((e) => {
      fs.unlinkSync(path.join(cwdPath, dir, e));
    });
  }

  while (symbols.length) {
    const obj = symbols.shift();
    createFile(obj, dir);
  }

  function createFile(obj, dir) {
    const fileName = obj.$.id;
    const pathContent = obj.path.map((e) => {
      if (excludes.includes(fileName)) {
        return `<path d="${e.$.d}" ${
          e.$.fill ? 'fill=' + e.$.fill : null
        }></path>`;
      } else {
        return `<path :style="{fill: color}" d="${e.$.d}" ${
          e.$.fill ? 'fill=' + e.$.fill : null
        }></path>`;
      }
    });

    const content = `<template>
      <div style="display: flex;align-items: center;">
        <svg viewBox="0 0 1024 1024" :width="size" :height="size">
          ${pathContent.join(' ')}
        </svg>
      </div>
    </template>
    
    <script>
    export default {
      props: {
        size: String,
        color: String
      },
    }
    </script>
    `;
    fs.writeFileSync(path.join(cwdPath, dir, `${fileName}.vue`), content);
  }
}

function createIndex(symbols, dir) {
  const files = fs.readdirSync(path.join(cwdPath, dir));
  const content = `
  <template>
    <div class="iconfont">
      <component :size="size" :color="theme[dir]" v-bind:is="currentView"></component>
    </div>
  </template>

  <script>
  ${files.map((e) => `import ${e.split('.')[0]} from './${e}'`).join(';')}
  import { useStore } from 'vuex';
  import theme from '../config/theme';
  import { computed } from 'vue';
  export default {
    props: {
      size: String,
      color: {
        type: String,
        default: 'background',
      },
      name: String
    },
    components: {
      ${files.map((e) => e.split('.')[0])},
    },
    data() {
      return {
        currentView: null,
        theme,
      }
    },
    mounted() {
      if (this.name) {
        this.currentView = this.name;
      }
    },
    setup(props) {
      const store = useStore();
      const dir = computed(() => \`\$\{store.state.theme\}-\$\{props.color\}\`);
      const color = props;
      if (!theme[dir.value]) {
        theme[dir.value] = color.color;
      }
      return { dir };
    },
  }
  </script>
  `;
  fs.writeFileSync(path.join(cwdPath, dir, `index.vue`), content);
}

function existsConfig(path) {
  return new Promise((resolve, reject) => {
    const res = fs.existsSync(path);
    if (res) resolve();
    else reject();
  });
}

function getParenthesesStr(text, start, end) {
  let result = '';
  //字符串拼接 正则表达式文本
  let regex = `/${start}(.+?)${end}/g`;
  //把字符串转换成js代码
  regex = eval(regex);
  let regResult = text.match(regex);
  if (regResult) {
    let item = regResult[0];
    //去除反斜杠
    start = start.replace(/\\/g, '');
    end = end.replace(/\\/g, '');
    if (item) {
      result = item.substring(start.length, item.length - end.length);
    }
  }
  return result;
}

function parser(data) {
  return new Promise((resolve, reject) => {
    try {
      let res = getParenthesesStr(data, '<svg>', '<\\/svg>');
      xml2js.parseString(`<svg>${res}</svg>`, (err, data) => {
        if (err) reject(err);
        resolve(data.svg);
      });
    } catch (error) {
      reject(error);
    }
  });
}

init();
