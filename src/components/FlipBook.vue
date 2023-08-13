<script setup lang="ts">
const props = defineProps({
  url: {
    type: String,
    required: true,
  },
})

declare const window: any

import jquery from 'jquery'
import * as pdfjs from 'pdfjs-dist'

import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?worker'
import { computed, onMounted, reactive, ref } from 'vue'
import '@ksedline/turnjs'
import type { Ref } from 'vue'

if (typeof window !== 'undefined') {
  window.$ = jquery
  window.jQuery = jquery
}

let pdfObj: any = null

const flipbookContainer: Ref<HTMLElement | null> = ref(null)
const flipbookIdPrefix = 'flipbook-'
const zoomScale = 0.1

const state: {
  numPages: number
  largestPageWidth: number
  largestPageHeight: number
  landscapePages: number
  portraitPages: number

  flipbookWidth: number
  flipbookHeight: number
  turnObj: any
  jqueryFlipbook: any

  canvasPageWidth: number
  canvas: any

  zoom: number
} = reactive({
  // The PDF
  numPages: 0,
  largestPageWidth: 0,
  largestPageHeight: 0,
  landscapePages: 0,
  portraitPages: 0,

  // The flipbook
  flipbookWidth: 0, // Full width of the flipbook - pages are half of this
  flipbookHeight: 0,
  turnObj: null,
  jqueryFlipbook: null,

  // Canvas
  canvasPageWidth: 0,
  canvas: {},

  // Controls
  zoom: 1,
  singlePageView: true,
})

const orientation = computed(() => {
  if (state.largestPageWidth > state.largestPageHeight)
    return 'landscape'
  else
    return 'portrait'
})

const flipbookDimensions = computed(() => {
  if (flipbookContainer.value) {
    const width = flipbookContainer.value.clientWidth
    const height = flipbookContainer.value.clientHeight

    if (width > height) {
      const canvasHeight = (state.largestPageHeight * (width / 2)) / (state.largestPageWidth)

      // if the canvasheight does not exceed the height of the container, then we can use the width
      if (canvasHeight < height) {
        return {
          width,
          height: canvasHeight,
        }
      }

      else {
        return {
          width: (state.largestPageWidth * 2) * height / state.largestPageHeight,
          height,
        }
      }
    }
    else {
      const canvasWidth = ((state.largestPageWidth * 2) * height) / state.largestPageHeight

      // if the canvaswidth does not exceed the width of the container, then we can use the height
      if (canvasWidth < width) {
        return {
          width: canvasWidth,
          height,
        }
      }

      else {
        return {
          width,
          height: (state.largestPageHeight * width / 2) / state.largestPageWidth,
        }
      }
    }
  }
  else { return { width: 0, height: 0 } }
})

function calculateCanvasSize() {
  if (flipbookContainer.value)
    state.canvasPageWidth = flipbookContainer.value.clientWidth / 2
}

async function setPageCanvas(page: number) {
  const canvasId = flipbookIdPrefix + page

  if (pdfObj) {
    const pageObj = await pdfObj.getPage(page)

    const nativePageWidth = pageObj.view[2]
    const nativePageHeight = pageObj.view[3]

    const canvasHeight = (nativePageHeight * state.canvasPageWidth) / nativePageWidth
    const pageScale = canvasHeight / nativePageHeight
    const viewport = pageObj.getViewport({ scale: pageScale * state.zoom })
    state.canvas[canvasId] = document.querySelector(`#${canvasId}`)
    try {
      const context = state.canvas[canvasId].getContext('2d')
      state.canvas[canvasId].height = canvasHeight
      state.canvas[canvasId].width = viewport.width

      // Render PDF page into canvas context
      const renderContext = {
        canvasContext: context,
        viewport,
      }

      await pageObj.render(renderContext)

      pageObj.getTextContent().then((textContent) => {
        // Assign CSS to the textLayer element
        const textLayer: HTMLDivElement | null = document.querySelector(`#${canvasId}-textlayer`)

        if (textLayer) {
          textLayer.style.left = `${state.canvas[canvasId].offsetLeft}px`
          textLayer.style.top = `${state.canvas[canvasId].offsetTop}px`
          textLayer.style.height = `${state.canvas[canvasId].offsetHeight}px`
          textLayer.style.width = `${state.canvas[canvasId].offsetWidth}px`

          // Pass the data to the method for rendering of text over the pdf canvas.
          pdfjs.renderTextLayer({
            textContent,
            container: textLayer,
            viewport,
            textDivs: [],
          })
        }
      })
    }
    catch (err: any) {
      throw new Error(err)
    }
  }
}

async function loadPdf() {
  if (flipbookContainer.value) {
    // Clear the flipbook
    flipbookContainer.value.innerHTML = ''

    const load = pdfjs.getDocument(props.url)
    pdfObj = await load.promise
    state.numPages = pdfObj.numPages
  }
}

async function buildFlipbook() {
  if (flipbookContainer.value) {
    // Clear the flipbook
    flipbookContainer.value.innerHTML = ''

    // Build and calculate the flipbook
    for (let i = 1; i <= state.numPages; i++) {
      const id = flipbookIdPrefix + i
      const div = document.createElement('div')
      div.innerHTML = `<canvas id="${id}"></canvas><div id="${id}-textlayer" class="textLayer"></div>`
      flipbookContainer.value.append(div)

      // Figure out the largest dimensions of the PDF
      const pageDims = await pdfObj.getPage(i)
      if (pageDims.view[2] > state.largestPageWidth)
        state.largestPageWidth = pageDims.view[2]
      if (pageDims.view[3] > state.largestPageHeight)
        state.largestPageHeight = pageDims.view[3]

      // Add to the portrait or landscape count
      if (pageDims.view[2] > pageDims.view[3])
        state.landscapePages++
      else
        state.portraitPages++
    }
    for (let i = 1; i <= state.numPages; i++)
      await setPageCanvas(i)
  }
}

async function loadTurnObj() {
  state.jqueryFlipbook = jquery(flipbookContainer.value)
  const turnObj = state.jqueryFlipbook.turn()
  state.turnObj = turnObj
}

function zoomIn() {
  state.zoom += zoomScale
}

function zoomOut() {
  state.zoom -= zoomScale
}

async function setFlipbookDimensions() {
  state.jqueryFlipbook.turn('size', flipbookDimensions.value.width, flipbookDimensions.value.height)
}

if (typeof window !== 'undefined') {
  window.pdfjsWorker = pdfjsWorker
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`
}

onMounted(async () => {
  // Initialize the flipbook
  calculateCanvasSize()
  await loadPdf()
  await buildFlipbook()
  await loadTurnObj()
  setFlipbookDimensions()
})
</script>

<template>
  <div class="relative h-screen w-screen flex flex-col justify-between">
    <div class="flex-1 flex justify-center items-center overflow-hidden bg-red-500 p-12">
      <div id="flipbook-container" ref="flipbookContainer" class="bg-blue-500 w-[90vw] h-[90vh]" :style="{ zoom: state.zoom }" />
      <!-- <div style="position:absolute; top:0; left:0; bottom:0;">
        <FlipBookThumbnails :url="url" />
      </div> -->
    </div>
    <div class="flex justify-center">
      <div class="flex space-x-3 p-2 px-4 bg-gray-700 rounded text-gray-100">
        <button @click="zoomIn">
          Zoom In
        </button>
        <button @click="zoomOut">
          Zoom Out
        </button>
        <button @click="setHeight">
          Set Height
        </button>
      </div>
    </div>

    <div class="fixed bottom-2 left-2 text-xs p-2 rounded bg-gray-800 grid grid-cols-2 text-white">
      <div>
        PDF Largest Page Width:
      </div>
      <div v-if="flipbookContainer" class="text-right">
        {{ state.largestPageWidth }}px
      </div>
      <div>
        PDF Largest Page Height:
      </div>
      <div v-if="flipbookContainer" class="text-right">
        {{ state.largestPageHeight }}px
      </div>
      <div>
        Calculated Orientation:
      </div>
      <div v-if="flipbookContainer" class="text-right">
        {{ orientation }}
      </div>
      <div>
        Flipbook Area Width:
      </div>
      <div v-if="flipbookContainer" class="text-right">
        {{ flipbookDimensions.width }}px
      </div>
      <div>
        Flipbook Area Height:
      </div>
      <div v-if="flipbookContainer" class="text-right">
        {{ flipbookDimensions.height }}px
      </div>
    </div>
  </div>
</template>

<style lang="scss">
#flipbook-container {
  .page-wrapper {
      @apply w-1/2 h-auto text-lg text-center flex items-center;
  }

  .odd {
    background: -webkit-gradient(linear, right top, left top, color-stop(0.95, #FFF), color-stop(1, #DADADA));
    box-shadow: inset 0 0 5px #666;
  }

  .even {
    background: -webkit-gradient(linear, left top, right top, color-stop(0.95, #fff), color-stop(1, #dadada));
    box-shadow: inset 0 0 5px #666;
  }
}

/* Copyright 2014 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

 :root {
  --highlight-bg-color: rgba(180, 0, 170, 1);
  --highlight-selected-bg-color: rgba(0, 100, 0, 1);
  --scale-factor: 1;
}

@media screen and (forced-colors: active) {
  :root {
    --highlight-bg-color: Highlight;
    --highlight-selected-bg-color: ButtonText;
  }
}

.textLayer {
  position: absolute;
  text-align: initial;
  inset: 0;
  overflow: hidden;
  opacity: 0.2;
  line-height: 1;
  text-size-adjust: none;
  forced-color-adjust: none;
  transform-origin: 0 0;
  z-index: 2;
}

.textLayer :is(span, br) {
  color: transparent;
  position: absolute;
  white-space: pre;
  cursor: text;
  transform-origin: 0% 0%;
  font-size:12px;
}

/* Only necessary in Google Chrome, see issue 14205, and most unfortunately
 * the problem doesn't show up in "text" reference tests. */
/*#if !MOZCENTRAL*/
.textLayer span.markedContent {
  top: 0;
  height: 0;
}
/*#endif*/

.textLayer .highlight {
  margin: -1px;
  padding: 1px;
  background-color: var(--highlight-bg-color);
  border-radius: 4px;
}

.textLayer .highlight.appended {
  position: initial;
}

.textLayer .highlight.begin {
  border-radius: 4px 0 0 4px;
}

.textLayer .highlight.end {
  border-radius: 0 4px 4px 0;
}

.textLayer .highlight.middle {
  border-radius: 0;
}

.textLayer .highlight.selected {
  background-color: var(--highlight-selected-bg-color);
}

.textLayer ::selection {
  /*#if !MOZCENTRAL*/
  background: blue;
  /*#endif*/
  background: AccentColor;
}

/* Avoids https://github.com/mozilla/pdf.js/issues/13840 in Chrome */
/*#if !MOZCENTRAL*/
.textLayer br::selection {
  background: transparent;
}
/*#endif*/

.textLayer .endOfContent {
  display: block;
  position: absolute;
  inset: 100% 0 0;
  z-index: -1;
  cursor: default;
  user-select: none;
}

.textLayer .endOfContent.active {
  top: 0;
}
</style>
