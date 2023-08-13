/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  extends: '@antfu',

  rules: {
    'vue/no-v-html': 'off',
    'import/first': 'off',
    'no-console': 'off',
  },
}
