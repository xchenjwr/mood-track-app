<template>
  <view>
    <!-- 导航栏 -->
    <up-navbar
      :title="emoData?.name"
      left-icon="arrow-left"
      @left-click="goBack"
      right-icon="setting"
      @right-click="openEmoActions"
      :placeholder="true" />

    <view class="pd-5">
      <!-- 情绪列表 -->
      <RecordList :emoData="emoData" />
    </view>

    <!-- 操作情绪抽屉 -->
    <up-action-sheet
      :show="emoActionsShow"
      :actions="emoActions"
      @select="selectAction"
      @close="emoActionsShow = false" />
    <!-- 修改情绪弹窗 -->
    <EditEmoModal
      v-model:show="editEmoShow"
      :id="emoData.id"
      :name="emoData.name" />
    <!-- 转移情绪到对象 -->
    <up-picker
      :show="transferProfileShow"
      :columns="profileColumns"
      keyName="text"
      valueName="value"
      @confirm="transferEmoConfirm"
      @cancel="transferProfileShow = false" />

    <!-- 悬浮新增记录按钮 -->
    <view class="fab-btn" @tap="openAddRecord">
      <up-icon name="plus" size="24" color="#fff"></up-icon>
    </view>

    <!-- 新增记录弹窗 -->
    <up-modal
      :show="addRecordShow"
      title="新增记录"
      showCancelButton
      @confirm="confirmAddRecord"
      @cancel="addRecordShow = false"
      :closeOnClickOverlay="true">
      <view class="record-edit-wrap">
        <up-textarea
          v-model="recordDesc"
          placeholder="记录描述（50字以内）"
          maxlength="50"
          count
          :height="100" />
      </view>
    </up-modal>
  </view>
</template>
<script lang="ts" setup>
import { reactive, ref, computed, nextTick, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { onLoad } from "@dcloudio/uni-app";
import dayjs from "dayjs";
// @ts-ignore
import uCharts from "@qiun/ucharts";
import type { EmoType, ProfileType } from "@/common/interfaces";
import { useEmoStore } from "@/stores/user";
import RecordList from "./record-list.vue";
import EditEmoModal from "@/pages/index/components/edit-emo-modal.vue";

const store = useEmoStore();
const { getEmo, deleteEmo, transferEmoToProfile, switchProfile, addRecord } =
  store;
const { profileList, data } = storeToRefs(store);

const emoId = ref(0); // 情绪ID
let emoData = reactive({} as EmoType); // 情绪详情数据

// 从store同步最新情绪数据
function syncEmoData() {
  const emo = emoId.value && getEmo(emoId.value);
  if (emo) {
    Object.assign(emoData, emo);
  }
}
let emoActionsShow = ref<boolean>(false); // 操作情绪抽屉显示状态
const emoActions = [
  { value: 1, name: "修改情绪名称" },
  { value: 2, name: "删除情绪" },
  { value: 3, name: "转移到其他对象" },
];
let editEmoShow = ref<boolean>(false); // 编辑情绪弹窗显示状态
let transferProfileShow = ref<boolean>(false);

const profileColumns = computed(() => [
  profileList.value
    .filter((p) => p.id !== data.value.currentProfileId)
    .map((p) => ({ text: p.name, value: p.id })),
]);

// Tabs相关
const activeTab = ref(0);
const tabs = [{ name: "记录" }, { name: "统计" }];

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

// 当前页面的对象
const currentProfile = computed<ProfileType | undefined>(() =>
  data.value.profiles.find((p) => p.id === data.value.currentProfileId)
);

let emoChart: any = null;
const emoHiddenMap = ref<Record<string, boolean>>({});
const canvasSizeCache = new Map<string, { width: number; height: number }>();

// 统计数据相关
let profileDayCounts = new Map<number, Map<string, number>>();
let emoDayCounts = new Map<number, Map<number, Map<string, number>>>();
let emoNameById = new Map<number, string>();
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
    const nextEmoNameById = new Map<number, string>();
    const nextTopEmoIdsByProfile = new Map<number, number[]>();

    const profiles = data.value?.profiles || [];
    for (const p of profiles) {
      const pDay = new Map<string, number>();
      const emoMap = new Map<number, Map<string, number>>();
      const emoTotals = new Map<number, number>();

      for (const emo of p.emos || []) {
        nextEmoNameById.set(emo.id, emo.name);

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
    }

    profileDayCounts = nextProfileDayCounts;
    emoDayCounts = nextEmoDayCounts;
    emoNameById = nextEmoNameById;
    topEmoIdsByProfile = nextTopEmoIdsByProfile;

    scheduleRerenderAll();
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

  const series = topIds
    .map((emoId: number, idx: number) => {
      const eDay = pEmoMap.get(emoId) || new Map<string, number>();
      const dataArr = dayKeys.map((k) => eDay.get(k) || 0);
      const name = emoNameById.get(emoId) || `情绪${emoId}`;
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
  return topIds.map((emoId, idx) => {
    const name = emoNameById.get(emoId) || `情绪${emoId}`;
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
  if (emoChart && typeof emoChart.updateData === "function") {
    emoChart.updateData({
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
  emoChart = new uCharts({
    type: "line",
    context: uni.createCanvasContext("emoLine"),
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
  await renderEmoChart();
}

let scheduleAllTimer: any = null;
let scheduleEmoTimer: any = null;
function scheduleRerenderAll() {
  if (scheduleAllTimer) clearTimeout(scheduleAllTimer);
  scheduleAllTimer = setTimeout(() => {
    scheduleAllTimer = null;
    rerenderAll();
  }, 0);
}
function scheduleRenderEmoOnly() {
  if (scheduleEmoTimer) clearTimeout(scheduleEmoTimer);
  scheduleEmoTimer = setTimeout(() => {
    scheduleEmoTimer = null;
    nextTick().then(() => renderEmoChart());
  }, 0);
}

onLoad((option: any) => {
  emoId.value = Number(option.id) || 0;
  syncEmoData();
});

onMounted(async () => {
  rebuildAggIndex();
  await rerenderAll();
});

watch(
  () => [rangeKey.value, profileList.value.length],
  async () => {
    scheduleRerenderAll();
  }
);

watch(
  () =>
    customRange.value
      ? `${customRange.value.start}|${customRange.value.end}`
      : "",
  () => {
    if (rangeKey.value === "custom") scheduleRerenderAll();
  }
);

watch(
  () => data.value?.profiles,
  () => {
    rebuildAggIndex();
    syncEmoData();
  },
  { deep: true }
);

// 返回上一页
function goBack() {
  uni.navigateBack();
}

// 打开情绪操作菜单
function openEmoActions() {
  emoActionsShow.value = true;
}

// 情绪更多操作
function selectAction(e: any) {
  const { value } = e;
  switch (value) {
    case 1:
      editEmoShow.value = true;
      break;
    case 2:
      delEmo();
      break;
    case 3:
      openTransferProfile();
      break;
    default:
      break;
  }
  emoActionsShow.value = false;
}

// 新增记录弹窗相关
const addRecordShow = ref(false);
const recordDesc = ref("");

function openAddRecord() {
  recordDesc.value = "";
  addRecordShow.value = true;
}

function confirmAddRecord() {
  if (!emoData.id) return;
  const desc = recordDesc.value.trim();
  if (!desc) {
    uni.showToast({ title: "请输入记录描述", icon: "none", duration: 2000 });
    return;
  }
  addRecord(emoData.id, desc);
  addRecordShow.value = false;
  uni.showToast({ title: "新增成功", icon: "success", duration: 2000 });
}

function openTransferProfile() {
  if (!profileColumns.value[0]?.length) {
    uni.showToast({
      title: "请先在设置页新增对象",
      icon: "none",
      duration: 2500,
    });
    return;
  }
  transferProfileShow.value = true;
}

function transferEmoConfirm(e: any) {
  transferProfileShow.value = false;
  const target = e?.value?.[0];
  if (!target?.value) return;
  uni.showModal({
    title: "转移确认",
    content: `是否将情绪“${emoData.name}”转移到${target.text}？`,
    success: function (res) {
      if (res.confirm) {
        transferEmoToProfile(emoData.id, target.value);
        uni.showToast({ title: "转移成功", icon: "success", duration: 2000 });
        switchProfile(target.value);
        setTimeout(() => uni.navigateBack(), 500);
      }
    },
  });
}

// 删除情绪
function delEmo() {
  uni.showModal({
    title: "删除确认",
    content: `是否删除${emoData.name}情绪及其记录`,
    success: function (res) {
      if (res.confirm) {
        deleteEmo(emoData.id);
        uni.showToast({ title: "删除成功", icon: "success", duration: 2000 });
        setTimeout(() => uni.navigateBack(), 500);
      }
    },
  });
}

// 处理tab切换
function handleTabChange() {
  if (activeTab.value === 1) {
    nextTick().then(() => renderEmoChart());
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
.pd-5 {
  padding: 10px;
}
.mb-10 {
  margin-bottom: 10px;
}

/* 统计tab样式 */
.stats-tab {
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

.record-edit-wrap {
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

.fab-btn {
  position: fixed;
  right: 24px;
  bottom: 25%;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3c9cff, #2b7fe8);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(60, 156, 255, 0.35);
  z-index: 100;

  &:active {
    transform: scale(0.92);
    opacity: 0.85;
  }
}
</style>
