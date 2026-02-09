import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { getId } from "@/utils/functions";
import type { EmoType, Records } from "@/common/interfaces";

export const useEmoStore = defineStore("emo", () => {
  // state
  let emoArray = ref<Array<EmoType>>([]);

  // getter

  // 情绪名数组, 防止重名
  let emoNameArray = computed(() => {
    return emoArray.value.map((item: EmoType) => item.name) || [];
  });

  // 情绪ID数组， 自增ID需要
  let emoIdArray = computed(
    () => emoArray.value.map((item: EmoType) => item.id) || [],
  );

  // actions

  // 保存数据
  function save() {
    uni.setStorageSync("userInfo", emoArray.value);
  }

  // 导入数据
  function importEmoData(data: Array<EmoType>) {
    emoArray.value = data;
    save();
  }

  // 获取本地数据
  function getEmoInfo() {
    const userInfo = uni.getStorageSync("userInfo");
    if (userInfo) {
      emoArray.value = userInfo;
    }
  }

  /**
   * 创建情绪value:
   * @param {string} name 情绪名
   * @param {string} desc 产生情绪的描述
   * @return
   */
  function createEmo(name: string, desc: string = "") {
    emoArray.value.push({
      id: getId(emoIdArray.value),
      name,
      record: [{ id: 1, desc, time: Math.floor(Date.now() / 1000) }],
    });
    save();
  }

  /**
   * 删除某个情绪
   * @param {number} id 情绪id
   * @return
   */
  function deleteEmo(id: number) {
    const targetIndex = emoArray.value.findIndex(
      (item: EmoType) => item.id === id,
    );
    emoArray.value.splice(targetIndex, 1);
    save();
  }

  /**
   * 修改情绪名称
   * @param id 情绪id
   * @param newName 修改后的情绪名称
   * @returns
   */
  function updateEmo(id: number, newName: string) {
    let targetEmoIndex = emoArray.value.findIndex(
      (item: EmoType) => item.id === id,
    );
    if (targetEmoIndex === -1) {
      return;
    }
    emoArray.value[targetEmoIndex] = {
      ...emoArray.value[targetEmoIndex],
      name: newName,
    };
    save();
  }

  // 获取情绪信息
  function getEmo(id: number) {
    const target = emoArray.value.find((item: EmoType) => item.id === id);
    return target;
  }

  /**
   * 添加情绪记录
   * @param {number} id 情绪id
   * @param {string} desc 产生该情绪的描述
   * @return
   */
  function addRecord(id: number, desc: string = "") {
    const target = emoArray.value.find((item: EmoType) => item.id === id);
    if (!target) {
      return;
    }
    const newId = getId(target.record.map((item) => item.id));
    target.record.push({
      id: newId,
      desc,
      time: Math.floor(Date.now() / 1000),
    });
    save();
  }

  /**
   * 更新记录信息
   * @param {number} eid 情绪id
   * @param {number} rid 记录id
   * @param {string} desc 更新的描述信息
   * @return
   */
  function updateRecord(eid: number, rid: number, desc: string = "") {
    const targetEmo = emoArray.value.find((item: EmoType) => item.id === eid);
    if (!targetEmo) {
      return;
    }
    let targetRecord = targetEmo.record.find(
      (item: Records) => item.id === rid,
    );
    if (!targetRecord) {
      return;
    }
    targetRecord = {
      ...targetRecord,
      desc,
    };
    save();
  }

  /**
   * 删除记录信息
   * @param {number} eid 情绪id
   * @param {number} rid 记录id
   * @return
   */
  function deleteRecord(eid: number, rid: number) {
    const targetEmo = emoArray.value.find((item: EmoType) => item.id === eid);
    if (!targetEmo) {
      return;
    }
    const targetRecordIndex = targetEmo.record.findIndex(
      (item) => item.id === rid,
    );
    targetEmo.record.splice(targetRecordIndex, 1);
    save();
  }

  return {
    emoArray,
    emoNameArray,
    importEmoData,
    getEmoInfo,
    createEmo,
    updateEmo,
    deleteEmo,
    getEmo,
    addRecord,
    updateRecord,
    deleteRecord,
  };
});
