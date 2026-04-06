<template>
  <view>
    <!-- 导航栏 -->
    <up-navbar
      :title="navTitle"
      left-icon="arrow-left"
      @left-click="goBack"
      :placeholder="true"
    />

    <!-- Tabs标签 -->
    <up-tabs v-model="activeTab" :current="activeTab" :list="tabs" @change="handleTabChange" />

    <!-- 简介tab -->
    <view v-if="activeTab === 0" class="desc-tab">
      <view class="desc-card">
        <view class="desc-card-body">
          <text v-if="profileDescription" class="desc-text">{{ profileDescription }}</text>
          <text v-else class="desc-empty">暂无简介信息，点击右侧图标添加</text>
        </view>
        <view class="desc-card-edit" @tap.stop="openEditDesc">
          <up-icon name="edit-pen" size="18" color="#999"></up-icon>
        </view>
      </view>
    </view>

    <!-- 列表tab -->
    <view v-if="activeTab === 1">
      <!-- 情绪列表 -->
      <view v-if="emoList.length" class="emo-list">
        <up-card
          v-for="item in emoList"
          :key="item.id"
          :showHead="false"
          @tap="toEmoDetail(item.id)"
        >
          <template #body>
            <view class="emo-cell">
              <view>{{ item.name }}</view>
              <view class="emo-cell-right">
                <up-badge
                  class="badge"
                  type="error"
                  :value="item.record.length"
                ></up-badge>
                <up-icon name="arrow-right"></up-icon>
              </view>
            </view>
          </template>
        </up-card>
      </view>
      <up-empty v-else class="no-list-data" mode="list" />
    </view>

    <!-- 统计tab -->
    <view v-if="activeTab === 2" class="stats-tab">
      <view class="range">
        <up-button
          size="small"
          :type="rangeKey === 'week' ? 'primary' : 'default'"
          @click="setRange('week')"
        >
          近一周
        </up-button>
        <up-button
          size="small"
          :type="rangeKey === 'month' ? 'primary' : 'default'"
          @click="setRange('month')"
        >
          近一月
        </up-button>
        <up-button
          size="small"
          :type="rangeKey === 'quarter' ? 'primary' : 'default'"
          @click="setRange('quarter')"
        >
          近三个月
        </up-button>
        <up-button
          size="small"
          :type="rangeKey === 'custom' ? 'primary' : 'default'"
          @click="openCustomRange"
        >
          自定义
        </up-button>
      </view>

      <view class="card">
        <view class="card-title">
          情绪记录次数趋势
          <text class="hint">（默认展示Top 5情绪）</text>
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
        <canvas canvas-id="emoLine" id="emoLine" class="chart-canvas"></canvas>
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
        @close="customCalendarShow = false"
      />
    </view>

    <!-- 编辑简介弹窗 -->
    <up-modal
      :show="editDescShow"
      title="编辑简介"
      showCancelButton
      @confirm="saveDescription"
      @cancel="editDescShow = false"
    >
      <view class="desc-edit-wrap">
        <up-textarea
          v-model="description"
          placeholder="请输入对象简介（100字以内）"
          maxlength="100"
          count
          :height="120"
        />
      </view>
    </up-modal>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { onLoad } from "@dcloudio/uni-app";
import dayjs from "dayjs";
// @ts-ignore
import uCharts from "@qiun/ucharts";
import type { ProfileType } from "@/common/interfaces";
import { useEmoStore } from "@/stores/user";

const store = useEmoStore();
const { emoList, currentProfileName, profileList, data, currentProfile } = storeToRefs(store);
const { updateProfileDescription } = store;

const navTitle = computed(() => {
  const n = currentProfileName.value || "";
  return n ? `情绪（${n}）` : "情绪";
});

// Tabs相关
const activeTab = ref(1);
const tabs = [{ name: "简介" }, { name: "列表" }, { name: "统计" }];

// 简介相关
const description = ref("");
const editDescShow = ref(false);
const profileDescription = computed(() => currentProfile.value?.description || "");

function openEditDesc() {
  description.value = currentProfile.value?.description || "";
  editDescShow.value = true;
}

function saveDescription() {
  if (!currentProfile.value) return;
  updateProfileDescription(currentProfile.value.id, description.value);
  editDescShow.value = false;
  uni.showToast({ title: "保存成功", icon: "success", duration: 2000 });
}

// 统计相关变量
const rangeKey = ref<"week" | "month" | "quarter" | "custom">("week");
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

let emoChart: any = null;
const emoHiddenMap = ref<Record<string, boolean>>({});
const canvasSizeCache = new Map<string, { width: number; height: number }>();

// 统计数据相关
let profileDayCounts = new Map<number, Map<string, number>>();
let emoDayCounts = new Map<number, Map<number, Map<string, number>>>();
let emoNameByIdByProfile = new Map<number, Map<number, string>>();
let topEmoIdsByProfile = new Map<number, number[]>();
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

function toYMDLocal(ms: number) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${pad2(m)}-${pad2(day)}`;
}

function ymdToMMDD(ymd: string) {
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
  if (rebuildAggTimer) clearTimeout(rebuildAggTimer);
  rebuildAggTimer = setTimeout(() => {
    rebuildAggTimer = null;

    const nextProfileDayCounts = new Map<number, Map<string, number>>();
    const nextEmoDayCounts = new Map<
      number,
      Map<number, Map<string, number>>
    >();
    const nextEmoNameByIdByProfile = new Map<number, Map<number, string>>();
    const nextTopEmoIdsByProfile = new Map<number, number[]>();

    const profiles = data.value?.profiles || [];
    for (const p of profiles) {
      const pDay = new Map<string, number>();
      const emoMap = new Map<number, Map<string, number>>();
      const emoTotals = new Map<number, number>();
      const emoNames = new Map<number, string>();

      for (const emo of p.emos || []) {
        emoNames.set(emo.id, emo.name);

        const eDay = new Map<string, number>();
        let eTotal = 0;
        for (const r of emo.record || []) {
          const ms = (r.time || 0) * 1000;
          if (!ms) continue;
          const dayMs = msAtLocalStartOfDay(ms);
          const key = toYMDLocal(dayMs);
          bumpMapCount(pDay, key, 1);
          bumpMapCount(eDay, key, 1);
          eTotal += 1;
        }
        emoMap.set(emo.id, eDay);
        emoTotals.set(emo.id, eTotal);
      }

      const topIds = [...emoTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);

      nextProfileDayCounts.set(p.id, pDay);
      nextEmoDayCounts.set(p.id, emoMap);
      nextTopEmoIdsByProfile.set(p.id, topIds);
      nextEmoNameByIdByProfile.set(p.id, emoNames);
    }

    profileDayCounts = nextProfileDayCounts;
    emoDayCounts = nextEmoDayCounts;
    emoNameByIdByProfile = nextEmoNameByIdByProfile;
    topEmoIdsByProfile = nextTopEmoIdsByProfile;

    // 只有当前在统计tab时才渲染
    if (activeTab.value === 2) {
      scheduleRerenderAll();
    }
  }, 0);
}

function getDayBuckets(key: "week" | "month" | "quarter" | "custom") {
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

function calcEmoSeries(
  key: "week" | "month" | "quarter" | "custom",
  profile: ProfileType
) {
  const { categories, dayKeys } = getDayBuckets(key);
  const topIds = topEmoIdsByProfile.get(profile.id) || [];
  const pEmoMap =
    emoDayCounts.get(profile.id) || new Map<number, Map<string, number>>();
  const pEmoNames =
    emoNameByIdByProfile.get(profile.id) || new Map<number, string>();

  const series = topIds
    .map((emoId: number, idx: number) => {
      const eDay = pEmoMap.get(emoId) || new Map<string, number>();
      const dataArr = dayKeys.map((k) => eDay.get(k) || 0);
      const name = pEmoNames.get(emoId) || `情绪${emoId}`;
      return {
        name,
        data: dataArr,
        color: palette[idx % palette.length],
        hidden: !!emoHiddenMap.value[name],
      };
    })
    .filter((s) => !s.hidden);
  return { categories, series };
}

const emoLegendItems = computed(() => {
  const p = currentProfile.value;
  if (!p) return [];
  const topIds = topEmoIdsByProfile.get(p.id) || [];
  const pEmoNames = emoNameByIdByProfile.get(p.id) || new Map<number, string>();
  return topIds.map((emoId, idx) => {
    const name = pEmoNames.get(emoId) || `情绪${emoId}`;
    return {
      name,
      color: palette[idx % palette.length],
      hidden: !!emoHiddenMap.value[name],
    };
  });
});

function toggleEmoLegend(name: string) {
  emoHiddenMap.value = {
    ...emoHiddenMap.value,
    [name]: !emoHiddenMap.value[name],
  };
  nextTick().then(() => renderEmoChart());
}

function getCanvasSize(
  canvasId: string
): Promise<{ width: number; height: number }> {
  // 每次都强制重新获取，不使用缓存
  return new Promise((resolve) => {
    const sys = uni.getSystemInfoSync();
    const fallback = {
      width: Math.max(320, (sys.windowWidth || 375) - 20),
      height: 260,
    };

    const platform = sys.platform;
    if (platform === "h5") {
      // H5环境
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const size = {
          width: rect.width > 0 ? rect.width : fallback.width,
          height: rect.height > 0 ? rect.height : fallback.height,
        };
        resolve(size);
      } else {
        resolve(fallback);
      }
    } else {
      // 小程序环境
      uni
        .createSelectorQuery()
        .select(`#${canvasId}`)
        .boundingClientRect((rect: any) => {
          const size = {
            width: rect?.width > 0 ? rect?.width : fallback.width,
            height: rect?.height > 0 ? rect?.height : fallback.height,
          };
          resolve(size);
        })
        .exec();
    }
  });
}

async function renderEmoChart() {
  const p = currentProfile.value;
  if (!p) return;
  
  const { categories, series } = calcEmoSeries(rangeKey.value, p);
  const maxVal =
    series.reduce((m: number, s: any) => Math.max(m, ...(s.data || [0])), 0) ||
    0;
  const niceY = calcNiceYAxis(maxVal, 5);
  const { width, height } = await getCanvasSize("emoLine");
  const pixelRatio = uni.getSystemInfoSync().pixelRatio || 1;

  // 获取canvas实例，兼容H5和小程序
  let canvasContext = null;
  const platform = uni.getSystemInfoSync().platform;

  if (platform === "h5") {
    // H5环境
    const canvas = document.getElementById("emoLine") as HTMLCanvasElement;
    if (canvas && canvas.width > 0 && canvas.height > 0) {
      canvasContext = canvas.getContext("2d");
    }
  } else {
    // 小程序环境
    canvasContext = uni.createCanvasContext("emoLine");
  }

  if (!canvasContext) {
    console.warn("无法获取canvas上下文，稍后重试");
    return;
  }

  // 如果图表已存在，销毁重建
  if (emoChart) {
    try {
      if (typeof emoChart.destroy === "function") {
        emoChart.destroy();
      }
    } catch (e) {}
    emoChart = null;
  }

  try {
    emoChart = new uCharts({
      type: "line",
      context: canvasContext,
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
  } catch (e) {
    console.error("创建图表失败:", e);
  }
}

async function rerenderAll() {
  await nextTick();
  // 多次尝试渲染，确保canvas已准备好
  await renderEmoChart();
  setTimeout(() => renderEmoChart(), 200);
  setTimeout(() => renderEmoChart(), 500);
}

let scheduleAllTimer: any = null;
function scheduleRerenderAll() {
  if (scheduleAllTimer) clearTimeout(scheduleAllTimer);
  scheduleAllTimer = setTimeout(() => {
    scheduleAllTimer = null;
    rerenderAll();
  }, 100);
}

onMounted(async () => {
  rebuildAggIndex();
});

watch(
  () => [rangeKey.value, profileList.value.length],
  async () => {
    if (activeTab.value === 2) {
      scheduleRerenderAll();
    }
  }
);

watch(
  () =>
    customRange.value
      ? `${customRange.value.start}|${customRange.value.end}`
      : "",
  () => {
    if (rangeKey.value === "custom" && activeTab.value === 2) scheduleRerenderAll();
  }
);

watch(
  () => data.value?.profiles,
  () => {
    rebuildAggIndex();
  },
  { deep: true }
);

// 监听tab切换，确保切换到统计tab时渲染图表
watch(activeTab, async (newVal) => {
  console.log("activeTab changed to:", newVal); // 调试日志
  if (newVal === 2) {
    // 等待DOM更新后多次尝试渲染
    await nextTick();
    setTimeout(() => {
      renderEmoChart();
      setTimeout(() => renderEmoChart(), 200);
      setTimeout(() => renderEmoChart(), 500);
    }, 100);
  }
});

function goBack() {
  uni.navigateBack();
}

// 增加情绪页
function toAddEmo() {
  uni.navigateTo({
    url: "/pages/emo/create",
  });
}

// 进入情绪详情页
function toEmoDetail(id: number) {
  uni.navigateTo({
    url: `/pages/emo/detail/detail?id=${id}`,
  });
}

// 处理tab切换 - 兼容多种事件格式
function handleTabChange(e: any) {
  console.log("Tab change event:", JSON.stringify(e)); // 调试日志
  
  // 尝试多种方式获取索引值
  let newIndex = 0;
  
  if (typeof e === "number") {
    newIndex = e;
  } else if (e && typeof e.index !== "undefined") {
    newIndex = e.index;
  } else if (e && typeof e.detail !== "undefined") {
    if (typeof e.detail === "number") {
      newIndex = e.detail;
    } else if (e.detail && typeof e.detail.index !== "undefined") {
      newIndex = e.detail.index;
    } else if (e.detail && typeof e.detail.value !== "undefined") {
      newIndex = e.detail.value;
    }
  } else if (e && typeof e.value !== "undefined") {
    newIndex = e.value;
  }
  
  console.log("Parsed tab index:", newIndex); // 调试日志
  
  // 确保索引在有效范围内
  if (newIndex >= 0 && newIndex < tabs.length) {
    activeTab.value = newIndex;
  }
}

// 统计相关方法
function setRange(key: "week" | "month" | "quarter" | "custom") {
  rangeKey.value = key;
}

function openCustomRange() {
  customCalendarShow.value = true;
}

function confirmCustomRange(e: any) {
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
  if (rangeKey.value === "custom") scheduleRerenderAll();
}
</script>

<style lang="less">
.emo-list {
  padding: 10px;
  .emo-cell {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .emo-cell-right {
      display: flex;
      margin-left: auto;
      gap: 10px;
    }
  }
}

/* 简介tab样式 */
.desc-tab {
  padding: 15px 10px;
}

.desc-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  background-color: #fff;
  border-radius: 8px;
  padding: 15px;
  min-height: 80px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.desc-card-body {
  flex: 1;
  padding-right: 12px;

  .desc-text {
    font-size: 14px;
    color: #666;
    line-height: 1.6;
    display: block;
    word-break: break-all;
  }

  .desc-empty {
    font-size: 14px;
    color: #999;
    font-style: italic;
  }
}

.desc-card-edit {
  flex-shrink: 0;
  padding-top: 2px;
}

.desc-edit-wrap {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;

  :deep(.u-textarea) {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
}

/* 统计tab样式 */
.stats-tab {
  padding-top: 15px;
}

.stats-title {
  display: block;
  text-align: center;
  font-size: 18px;
  font-weight: bold;
  color: #333;
  padding: 10px 0;
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
</style>