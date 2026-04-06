<template>
  <view class="stats-page">
    <up-navbar title="统计" left-icon="" :placeholder="true" />

    <view class="range">
      <up-button
        size="small"
        :type="rangeKey === 'week' ? 'primary' : 'default'"
        @click="setRange('week')">
        近一周
      </up-button>
      <up-button
        size="small"
        :type="rangeKey === 'month' ? 'primary' : 'default'"
        @click="setRange('month')">
        近一月
      </up-button>
      <up-button
        size="small"
        :type="rangeKey === 'quarter' ? 'primary' : 'default'"
        @click="setRange('quarter')">
        近三个月
      </up-button>
      <up-button
        size="small"
        :type="rangeKey === 'custom' ? 'primary' : 'default'"
        @click="openCustomRange">
        自定义
      </up-button>
    </view>

    <view class="card">
      <view class="card-title">对象情绪统计</view>
      <scroll-view
        scroll-x
        class="legend-scroll"
        v-if="profileLegendItems.length">
        <view class="legend-row">
          <view
            v-for="it in profileLegendItems"
            :key="it.name"
            class="legend-item"
            :class="{ off: it.hidden }"
            @tap="toggleProfileLegend(it.name)">
            <view class="dot" :style="{ backgroundColor: it.color }"></view>
            <text class="legend-text">{{ it.name }}</text>
          </view>
        </view>
      </scroll-view>
      <canvas
        canvas-id="profileLine"
        id="profileLine"
        class="chart-canvas"></canvas>
    </view>

    <up-calendar
      :show="customCalendarShow"
      mode="range"
      :minDate="calendarMinDate"
      :maxDate="calendarMaxDate"
      :monthNum="calendarMonthNum"
      :maxRange="92"
      rangePrompt="选择天数不能超过 3 个月"
      :showRangePrompt="true"
      @confirm="confirmCustomRange"
      @close="customCalendarShow = false" />

    <CustomTabBar />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import dayjs from "dayjs";
// @ts-ignore
import uCharts from "@qiun/ucharts";
import { useEmoStore } from "@/stores/user";
import type { ProfileType, EmoType } from "@/common/interfaces";
import CustomTabBar from "@/common/components/custom-tab-bar.vue";

type RangeKey = "week" | "month" | "quarter" | "custom";

const { data, profileList } = storeToRefs(useEmoStore());

const rangeKey = ref<RangeKey>("week");
const customCalendarShow = ref(false);
const customRange = ref<{ start: string; end: string } | null>(null);

const calendarMinDate = computed(() =>
  dayjs().subtract(1, "year").format("YYYY-MM-DD")
);
const calendarMaxDate = computed(() => dayjs().format("YYYY-MM-DD"));
const calendarMonthNum = computed(() => {
  const min = dayjs(calendarMinDate.value).startOf("month");
  const max = dayjs(calendarMaxDate.value).startOf("month");
  return Math.max(1, max.diff(min, "month") + 1);
});

let profileChart: any = null;

const profileHiddenMap = ref<Record<string, boolean>>({});

const canvasSizeCache = new Map<string, { width: number; height: number }>();

// Pre-aggregated index for fastest switching:
// profileDayCounts[profileId][YYYY-MM-DD] => count of all records in that day
let profileDayCounts = new Map<number, Map<string, number>>();
let rebuildAggTimer: any = null;

const palette = [
  "#3c9cff",
  "#f56c6c",
  "#67c23a",
  "#e6a23c",
  "#909399",
  "#8a2be2",
  "#00c2a8",
  "#ff7f50",
  "#2f54eb",
  "#13c2c2",
];

function calcNiceYAxis(maxVal: number, splitNumber: number = 5) {
  const max = Math.max(0, Number(maxVal) || 0);
  const step = Math.max(1, Math.ceil(max / splitNumber));
  return { min: 0, max: step * splitNumber, splitNumber };
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function msAtLocalStartOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Faster than dayjs for per-record day key
function toYMDLocal(ms: number) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${pad2(m)}-${pad2(day)}`;
}

function ymdToMMDD(ymd: string) {
  // YYYY-MM-DD -> MM-DD
  return ymd.slice(5);
}

function bumpMapCount(
  map: Map<string, number>,
  key: string,
  delta: number = 1
) {
  map.set(key, (map.get(key) || 0) + delta);
}

function rebuildAggIndex() {
  // Merge frequent mutations into a single rebuild
  if (rebuildAggTimer) clearTimeout(rebuildAggTimer);
  rebuildAggTimer = setTimeout(() => {
    rebuildAggTimer = null;

    const nextProfileDayCounts = new Map<number, Map<string, number>>();

    const profiles = data.value?.profiles || [];
    for (const p of profiles) {
      const pDay = new Map<string, number>();

      for (const emo of p.emos || []) {
        for (const r of emo.record || []) {
          const ms = (r.time || 0) * 1000;
          if (!ms) continue;
          const dayMs = msAtLocalStartOfDay(ms);
          const key = toYMDLocal(dayMs);
          bumpMapCount(pDay, key, 1);
        }
      }

      nextProfileDayCounts.set(p.id, pDay);
    }

    profileDayCounts = nextProfileDayCounts;

    // Data changed: refresh chart(s) with latest index
    scheduleRerenderAll();
  }, 0);
}

function setRange(key: RangeKey) {
  rangeKey.value = key;
}

function openCustomRange() {
  customCalendarShow.value = true;
}

function confirmCustomRange(e: any) {
  // range 模式返回日期数组 ["YYYY-MM-DD", ...]
  const arr: string[] = Array.isArray(e) ? e : e?.result || e?.value || [];
  if (!arr.length) {
    customCalendarShow.value = false;
    return;
  }
  const start = arr[0];
  const end = arr[arr.length - 1];
  customRange.value = { start, end };
  rangeKey.value = "custom";
  customCalendarShow.value = false;
  // 二次选择自定义时 rangeKey 可能不变（仍是 custom），这里强制刷新
  scheduleRerenderAll();
}

function getDayBuckets(key: RangeKey) {
  // custom：最多 3 个月（由日历 maxRange 限制），按天聚合保持细粒度
  if (key === "custom" && customRange.value) {
    const start = dayjs(customRange.value.start).startOf("day");
    const end = dayjs(customRange.value.end).startOf("day");
    if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
      return getDayBuckets("week");
    }
    const startMs = start.valueOf();
    const endMs = end.valueOf();
    const dayKeys: string[] = [];
    for (let ms = startMs; ms <= endMs; ms += 24 * 60 * 60 * 1000) {
      dayKeys.push(toYMDLocal(ms));
    }
    const categories = dayKeys.map(ymdToMMDD);
    return { dayKeys, categories };
  }

  const days = key === "week" ? 7 : key === "month" ? 30 : 90;
  const todayMs = msAtLocalStartOfDay(Date.now());
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dayKeys.push(toYMDLocal(todayMs - i * 24 * 60 * 60 * 1000));
  }
  const categories = dayKeys.map(ymdToMMDD);
  return { dayKeys, categories };
}

function calcProfileSeries(key: RangeKey) {
  const { categories, dayKeys } = getDayBuckets(key);
  const series = profileList.value
    .map((p, idx) => {
      const pDay = profileDayCounts.get(p.id) || new Map<string, number>();
      const dataArr = dayKeys.map((k) => pDay.get(k) || 0);
      return {
        name: p.name,
        data: dataArr,
        color: palette[idx % palette.length],
        hidden: !!profileHiddenMap.value[p.name],
      };
    })
    .filter((s) => !s.hidden);
  return { categories, series };
}

const profileLegendItems = computed(() => {
  return profileList.value.map((p, idx) => ({
    name: p.name,
    color: palette[idx % palette.length],
    hidden: !!profileHiddenMap.value[p.name],
  }));
});

function toggleProfileLegend(name: string) {
  profileHiddenMap.value = {
    ...profileHiddenMap.value,
    [name]: !profileHiddenMap.value[name],
  };
  nextTick().then(() => renderProfileChart());
}

function getCanvasSize(
  canvasId: string
): Promise<{ width: number; height: number }> {
  const cached = canvasSizeCache.get(canvasId);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const sys = uni.getSystemInfoSync();
    const fallback = {
      width: Math.max(320, (sys.windowWidth || 375) - 20),
      height: 260,
    };
    uni
      .createSelectorQuery()
      .select(`#${canvasId}`)
      .boundingClientRect((rect: any) => {
        const size = {
          width: rect?.width || fallback.width,
          height: rect?.height || fallback.height,
        };
        canvasSizeCache.set(canvasId, size);
        resolve(size);
      })
      .exec();
  });
}

async function renderProfileChart() {
  const { categories, series } = calcProfileSeries(rangeKey.value);
  const maxVal =
    series.reduce((m: number, s: any) => Math.max(m, ...(s.data || [0])), 0) ||
    0;
  const niceY = calcNiceYAxis(maxVal, 5);
  const { width, height } = await getCanvasSize("profileLine");
  const pixelRatio = uni.getSystemInfoSync().pixelRatio || 1;
  if (profileChart && typeof profileChart.updateData === "function") {
    profileChart.updateData({
      categories,
      series,
      animation: false,
      yAxis: {
        min: niceY.min,
        max: niceY.max,
        splitNumber: niceY.splitNumber,
        data: [
          {
            fontSize: 6,
            min: niceY.min,
            max: niceY.max,
            splitNumber: niceY.splitNumber,
            toFixed: 0,
          },
        ],
      },
    });
    return;
  }
  profileChart = new uCharts({
    type: "line",
    context: uni.createCanvasContext("profileLine"),
    width,
    height,
    categories,
    series,
    fontSize: 8,
    animation: false,
    background: "#FFFFFF",
    pixelRatio,
    xAxis: {
      disableGrid: true,
      rotateLabel: true,
      labelCount: 6,
      fontSize: 6,
      marginTop: 4,
    },
    yAxis: {
      gridType: "dash",
      dashLength: 2,
      min: niceY.min,
      max: niceY.max,
      splitNumber: niceY.splitNumber,
      data: [
        {
          fontSize: 6,
          min: niceY.min,
          max: niceY.max,
          splitNumber: niceY.splitNumber,
          toFixed: 0,
        },
      ],
    },
    legend: { show: false },
    dataLabel: false,
    dataPointShape: false,
    extra: { line: { type: "straight", width: 1 } },
  });
}

async function rerenderAll() {
  await nextTick();
  await renderProfileChart();
}

let scheduleAllTimer: any = null;
function scheduleRerenderAll() {
  if (scheduleAllTimer) clearTimeout(scheduleAllTimer);
  scheduleAllTimer = setTimeout(() => {
    scheduleAllTimer = null;
    rerenderAll();
  }, 0);
}

onMounted(async () => {
  rebuildAggIndex();
  await rerenderAll();
});

watch(
  () => [rangeKey.value, profileList.value.length],
  async () => {
    // 切换时间范围：两张图都更新
    scheduleRerenderAll();
  }
);

watch(
  () =>
    customRange.value
      ? `${customRange.value.start}|${customRange.value.end}`
      : "",
  () => {
    // 二次/多次修改自定义时间：只要范围变了就刷新（当前在 custom 模式才需要）
    if (rangeKey.value === "custom") scheduleRerenderAll();
  }
);

watch(
  () => data.value?.profiles,
  () => {
    rebuildAggIndex();
  },
  { deep: true }
);
</script>

<style lang="less">
.stats-page {
  padding-top: 15px;
}
.range {
  display: flex;
  gap: 10px;
  padding: 10px;
}
.card {
  margin: 10px;
  padding: 12px;
  background-color: #fff;
  border-radius: 8px;
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}
.hint {
  font-size: 12px;
  color: #999;
  margin-left: 8px;
}
.chart-canvas {
  width: 100%;
  height: 260px;
}
.legend-scroll {
  width: 100%;
  margin-bottom: 6px;
}
.legend-row {
  display: flex;
  gap: 10px;
  padding: 2px 0;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #f6f7fb;
  border-radius: 999px;
  white-space: nowrap;
}
.legend-item.off {
  opacity: 0.45;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: 0 0 8px;
}
.legend-text {
  font-size: 12px;
  color: #333;
}
.picker-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0 10px;
}
.picker-label {
  color: #666;
  font-size: 13px;
}
.picker-value {
  flex: 1;
  font-size: 13px;
  color: #333;
}
</style>
