<template>
  <view class="stats-page">
    <up-navbar title="统计" left-icon="" :placeholder="true" />

    <view class="range">
      <up-button
        size="small"
        :type="rangeKey === 'week' ? 'primary' : 'default'"
        @click="setRange('week')"
        >近一周</up-button
      >
      <up-button
        size="small"
        :type="rangeKey === 'month' ? 'primary' : 'default'"
        @click="setRange('month')"
        >近一月</up-button
      >
      <up-button
        size="small"
        :type="rangeKey === 'quarter' ? 'primary' : 'default'"
        @click="setRange('quarter')"
        >近三个月</up-button
      >
      <up-button
        size="small"
        :type="rangeKey === 'custom' ? 'primary' : 'default'"
        @click="openCustomRange"
        >自定义</up-button
      >
    </view>

    <view class="card">
      <view class="card-title">不同对象：情绪记录次数趋势</view>
      <scroll-view scroll-x class="legend-scroll" v-if="profileLegendItems.length">
        <view class="legend-row">
          <view
            v-for="it in profileLegendItems"
            :key="it.name"
            class="legend-item"
            :class="{ off: it.hidden }"
            @tap="toggleProfileLegend(it.name)"
          >
            <view class="dot" :style="{ backgroundColor: it.color }"></view>
            <text class="legend-text">{{ it.name }}</text>
          </view>
        </view>
      </scroll-view>
      <canvas
        canvas-id="profileLine"
        id="profileLine"
        class="chart-canvas"
      ></canvas>
    </view>

    <view class="card">
      <view class="card-title">
        单对象：不同情绪记录次数趋势
        <text class="hint">（默认展示Top 5情绪）</text>
      </view>
      <view class="picker-row" @tap="openProfilePicker">
        <text class="picker-label">对象：</text>
        <text class="picker-value">{{ selectedProfileName || "请选择" }}</text>
        <up-icon name="arrow-right"></up-icon>
      </view>
      <scroll-view scroll-x class="legend-scroll" v-if="emoLegendItems.length">
        <view class="legend-row">
          <view
            v-for="it in emoLegendItems"
            :key="it.name"
            class="legend-item"
            :class="{ off: it.hidden }"
            @tap="toggleEmoLegend(it.name)"
          >
            <view class="dot" :style="{ backgroundColor: it.color }"></view>
            <text class="legend-text">{{ it.name }}</text>
          </view>
        </view>
      </scroll-view>
      <canvas
        canvas-id="emoLine"
        id="emoLine"
        class="chart-canvas"
      ></canvas>
    </view>

    <up-picker
      :show="profilePickerShow"
      :columns="profileColumns"
      keyName="text"
      valueName="value"
      @confirm="confirmProfile"
      @cancel="profilePickerShow = false"
    />

    <up-calendar
      :show="customCalendarShow"
      mode="range"
      :minDate="calendarMinDate"
      :maxDate="calendarMaxDate"
      :monthNum="12"
      :maxRange="92"
      rangePrompt="选择天数不能超过 3 个月"
      :showRangePrompt="true"
      @confirm="confirmCustomRange"
      @close="customCalendarShow = false"
    />

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

const calendarMinDate = computed(() => dayjs().subtract(1, "year").format("YYYY-MM-DD"));
const calendarMaxDate = computed(() => dayjs().format("YYYY-MM-DD"));


const profilePickerShow = ref(false);
const selectedProfileId = ref<number>(0);
const selectedProfile = computed<ProfileType | undefined>(() =>
  data.value.profiles.find((p) => p.id === selectedProfileId.value),
);
const selectedProfileName = computed(() => selectedProfile.value?.name || "");

const profileColumns = computed(() => [
  profileList.value.map((p) => ({ text: p.name, value: p.id })),
]);

let profileChart: any = null;
let emoChart: any = null;

const profileHiddenMap = ref<Record<string, boolean>>({});
const emoHiddenMap = ref<Record<string, boolean>>({});

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
}

function openProfilePicker() {
  profilePickerShow.value = true;
}

function confirmProfile(e: any) {
  profilePickerShow.value = false;
  const target = e?.value?.[0];
  if (!target?.value) return;
  selectedProfileId.value = Number(target.value);
}

function getBuckets(key: RangeKey) {
  // custom：最多 3 个月（由日历 maxRange 限制），按天聚合保持细粒度
  if (key === "custom" && customRange.value) {
    const start = dayjs(customRange.value.start).startOf("day");
    const end = dayjs(customRange.value.end).startOf("day");
    if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
      return getBuckets("week");
    }
    const diffDays = end.diff(start, "day") + 1;
    const arr: dayjs.Dayjs[] = [];
    for (let i = 0; i < diffDays; i++) {
      arr.push(start.add(i, "day"));
    }
    const categories = arr.map((d) => d.format("MM-DD"));
    const startMs = start.valueOf();
    const bucketIndex = (ms: number) => {
      const d = dayjs(ms).startOf("day");
      return arr.findIndex((x) => x.isSame(d, "day"));
    };
    return { categories, startMs, bucketCount: categories.length, bucketIndex };
  }

  const now = dayjs();
  const days = key === "week" ? 7 : key === "month" ? 30 : 90;
  const arr: dayjs.Dayjs[] = [];
  for (let i = days - 1; i >= 0; i--) {
    arr.push(now.subtract(i, "day").startOf("day"));
  }
  const categories = arr.map((d) => d.format("MM-DD"));
  const startMs = arr[0].valueOf();
  const bucketIndex = (ms: number) => {
    const d = dayjs(ms).startOf("day");
    return arr.findIndex((x) => x.isSame(d, "day"));
  };
  return { categories, startMs, bucketCount: categories.length, bucketIndex };
}

function calcProfileSeries(key: RangeKey) {
  const { categories, startMs, bucketCount, bucketIndex } = getBuckets(key);
  const series = profileList.value
    .map((p, idx) => {
    const dataArr = new Array(bucketCount).fill(0);
    (p.emos || []).forEach((emo) => {
      (emo.record || []).forEach((r) => {
        const ms = (r.time || 0) * 1000;
        if (ms < startMs) return;
        const idx = bucketIndex(ms);
        if (idx >= 0) dataArr[idx] += 1;
      });
    });
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

function calcEmoSeries(key: RangeKey, profile: ProfileType) {
  const { categories, startMs, bucketCount, bucketIndex } = getBuckets(key);
  const emos = [...(profile.emos || [])];
  // Top 5 by total records (within profile)
  emos.sort((a, b) => (b.record?.length || 0) - (a.record?.length || 0));
  const top = emos.slice(0, 5);

  const series = top
    .map((emo: EmoType, idx: number) => {
    const dataArr = new Array(bucketCount).fill(0);
    (emo.record || []).forEach((r) => {
      const ms = (r.time || 0) * 1000;
      if (ms < startMs) return;
      const idx = bucketIndex(ms);
      if (idx >= 0) dataArr[idx] += 1;
    });
    return {
      name: emo.name,
      data: dataArr,
      color: palette[idx % palette.length],
      hidden: !!emoHiddenMap.value[emo.name],
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

const emoLegendItems = computed(() => {
  const p = selectedProfile.value || profileList.value[0];
  if (!p) return [];
  const emos = [...(p.emos || [])];
  emos.sort((a, b) => (b.record?.length || 0) - (a.record?.length || 0));
  const top = emos.slice(0, 5);
  return top.map((emo, idx) => ({
    name: emo.name,
    color: palette[idx % palette.length],
    hidden: !!emoHiddenMap.value[emo.name],
  }));
});

function toggleProfileLegend(name: string) {
  profileHiddenMap.value = { ...profileHiddenMap.value, [name]: !profileHiddenMap.value[name] };
  rerenderAll();
}

function toggleEmoLegend(name: string) {
  emoHiddenMap.value = { ...emoHiddenMap.value, [name]: !emoHiddenMap.value[name] };
  rerenderAll();
}

function getCanvasSize(canvasId: string): Promise<{ width: number; height: number }> {
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
        resolve({
          width: rect?.width || fallback.width,
          height: rect?.height || fallback.height,
        });
      })
      .exec();
  });
}

async function renderProfileChart() {
  const { categories, series } = calcProfileSeries(rangeKey.value);
  const maxVal =
    series.reduce((m: number, s: any) => Math.max(m, ...(s.data || [0])), 0) || 0;
  const niceY = calcNiceYAxis(maxVal, 5);
  const { width, height } = await getCanvasSize("profileLine");
  const pixelRatio = uni.getSystemInfoSync().pixelRatio || 1;
  profileChart = new uCharts({
    type: "line",
    context: uni.createCanvasContext("profileLine"),
    width,
    height,
    categories,
    series,
    fontSize: 8,
    animation: true,
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

async function renderEmoChart() {
  const p = selectedProfile.value || profileList.value[0];
  if (!p) return;
  if (!selectedProfileId.value) selectedProfileId.value = p.id;
  const { categories, series } = calcEmoSeries(rangeKey.value, p);
  const maxVal =
    series.reduce((m: number, s: any) => Math.max(m, ...(s.data || [0])), 0) || 0;
  const niceY = calcNiceYAxis(maxVal, 5);
  const { width, height } = await getCanvasSize("emoLine");
  const pixelRatio = uni.getSystemInfoSync().pixelRatio || 1;
  emoChart = new uCharts({
    type: "line",
    context: uni.createCanvasContext("emoLine"),
    width,
    height,
    categories,
    series,
    fontSize: 8,
    animation: true,
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
  profileChart = null;
  emoChart = null;
  await renderProfileChart();
  await renderEmoChart();
}

onMounted(async () => {
  // 默认选中第一个对象
  if (!selectedProfileId.value && profileList.value[0]) {
    selectedProfileId.value = profileList.value[0].id;
  }
  await rerenderAll();
});

watch(
  () => [rangeKey.value, selectedProfileId.value, profileList.value.length],
  async () => {
    await rerenderAll();
  },
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

