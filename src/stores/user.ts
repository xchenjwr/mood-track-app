import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { getId } from "@/utils";
import type {
  AppDataV2,
  EmoType,
  ProfileType,
  RecordType,
} from "@/common/interfaces";

export const useEmoStore = defineStore("emo", () => {
  const STORAGE_KEY = "userInfo";

  // state (v2)
  const data = ref<AppDataV2>({
    version: 2,
    currentProfileId: 1,
    profiles: [{ id: 1, name: "个人", emos: [] }],
  });

  // 当前对象（profile）
  const currentProfile = computed<ProfileType | undefined>(() =>
    data.value.profiles.find((p) => p.id === data.value.currentProfileId)
  );

  // 兼容旧 API：当前对象下的情绪数组
  const emoArray = computed<Array<EmoType>>(
    () => currentProfile.value?.emos || []
  );

  // getter

  // 情绪名数组, 防止重名
  let emoNameArray = computed(() => {
    return emoArray.value.map((item: EmoType) => item.name) || [];
  });

  // 情绪ID数组， 自增ID需要
  let emoIdArray = computed(
    () => emoArray.value.map((item: EmoType) => item.id) || []
  );

  // 按照记录数量排序的情绪列表
  let emoList = computed(
    () =>
      [...emoArray.value].sort(
        (x: EmoType, y: EmoType) => y.record.length - x.record.length
      ) || []
  );

  // actions

  // 保存数据
  function save() {
    uni.setStorageSync(STORAGE_KEY, data.value);
  }

  function ensureCurrentProfile() {
    const exists = data.value.profiles.some(
      (p) => p.id === data.value.currentProfileId
    );
    if (!exists) {
      data.value.currentProfileId = data.value.profiles[0]?.id || 1;
    }
  }

  function migrateOldDataIfNeeded(raw: unknown): AppDataV2 {
    // 旧版：直接是 EmoType[]
    if (Array.isArray(raw)) {
      return {
        version: 2,
        currentProfileId: 1,
        profiles: [{ id: 1, name: "个人", emos: raw as Array<EmoType> }],
      };
    }
    // 新版：AppDataV2
    if (raw && typeof raw === "object") {
      const obj = raw as any;
      if (obj.version === 2 && Array.isArray(obj.profiles)) {
        const profiles = (obj.profiles as Array<any>)
          .filter((p) => p && typeof p === "object")
          .map((p) => ({
            id: Number(p.id) || 0,
            name: String(p.name || ""),
            emos: Array.isArray(p.emos) ? (p.emos as Array<EmoType>) : [],
          }))
          .filter((p) => p.id > 0 && p.name);
        const currentProfileId =
          Number(obj.currentProfileId) || profiles[0]?.id || 1;
        return {
          version: 2,
          currentProfileId,
          profiles: profiles.length
            ? profiles
            : [{ id: 1, name: "个人", emos: [] }],
        };
      }
    }
    return {
      version: 2,
      currentProfileId: 1,
      profiles: [{ id: 1, name: "个人", emos: [] }],
    };
  }

  // 获取本地数据
  function getEmoInfo() {
    const raw = uni.getStorageSync(STORAGE_KEY);
    const migrated = migrateOldDataIfNeeded(raw);
    data.value = migrated;
    ensureCurrentProfile();
    save(); // 如果是旧结构，顺便升级到 v2
  }

  // 导入数据（支持旧结构 EmoType[] 或新版 AppDataV2）
  function importEmoData(input: unknown) {
    const migrated = migrateOldDataIfNeeded(input);
    data.value = migrated;
    ensureCurrentProfile();
    save();
  }

  // ---- 对象（profile）管理 ----
  const profileNameArray = computed(() =>
    data.value.profiles.map((p) => p.name)
  );
  const profileIdArray = computed(() => data.value.profiles.map((p) => p.id));
  const profileList = computed(() => {
    const total = (p: ProfileType) =>
      p.emos?.reduce((sum, emo) => sum + (emo.record?.length || 0), 0) || 0;
    return [...data.value.profiles].sort((a, b) => total(b) - total(a));
  });
  const currentProfileName = computed(() => currentProfile.value?.name || "");

  function createProfile(name: string) {
    const trimmed = String(name || "").trim();
    if (!trimmed) return;
    if (profileNameArray.value.some((n) => n === trimmed)) return;
    const id = getId(profileIdArray.value);
    data.value.profiles.push({ id, name: trimmed, emos: [] });
    save();
  }

  function updateProfileName(id: number, newName: string) {
    const trimmed = String(newName || "").trim();
    if (!trimmed) return;
    const targetIndex = data.value.profiles.findIndex((p) => p.id === id);
    if (targetIndex === -1) return;
    // 重名校验（允许改回自身原名）
    const exists = data.value.profiles.some(
      (p) => p.name === trimmed && p.id !== id
    );
    if (exists) return;
    data.value.profiles[targetIndex] = {
      ...data.value.profiles[targetIndex],
      name: trimmed,
    };
    save();
  }

  function deleteProfile(id: number) {
    if (data.value.profiles.length <= 1) return;
    const targetIndex = data.value.profiles.findIndex((p) => p.id === id);
    if (targetIndex === -1) return;
    data.value.profiles.splice(targetIndex, 1);
    ensureCurrentProfile();
    save();
  }

  function switchProfile(id: number) {
    const target = data.value.profiles.find((p) => p.id === id);
    if (!target) return;
    data.value.currentProfileId = id;
    save();
  }

  function transferEmoToProfile(emoId: number, targetProfileId: number) {
    const source = currentProfile.value;
    if (!source) return;
    const target = data.value.profiles.find((p) => p.id === targetProfileId);
    if (!target) return;
    if (target.id === source.id) return;
    const emoIndex = source.emos.findIndex((e) => e.id === emoId);
    if (emoIndex === -1) return;
    const [emo] = source.emos.splice(emoIndex, 1);
    // 在目标对象内重新分配情绪 id，避免冲突
    emo.id = getId(target.emos.map((e) => e.id));
    target.emos.push(emo);
    save();
  }

  /**
   * 创建情绪value:
   * @param {string} name 情绪名
   * @param {string} desc 产生情绪的描述
   * @return
   */
  function createEmo(name: string, desc: string = "") {
    const p = currentProfile.value;
    if (!p) return;
    p.emos.push({
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
    const p = currentProfile.value;
    if (!p) return;
    const targetIndex = p.emos.findIndex((item: EmoType) => item.id === id);
    if (targetIndex === -1) return;
    p.emos.splice(targetIndex, 1);
    save();
  }

  /**
   * 修改情绪名称
   * @param id 情绪id
   * @param newName 修改后的情绪名称
   * @returns
   */
  function updateEmo(id: number, newName: string) {
    const p = currentProfile.value;
    if (!p) return;
    let targetEmoIndex = p.emos.findIndex((item: EmoType) => item.id === id);
    if (targetEmoIndex === -1) {
      return;
    }
    p.emos[targetEmoIndex] = {
      ...p.emos[targetEmoIndex],
      name: newName,
    };
    save();
  }

  // 获取情绪信息
  function getEmo(id: number) {
    const p = currentProfile.value;
    if (!p) return;
    const target = p.emos.find((item: EmoType) => item.id === id);
    return target;
  }

  /**
   * 添加情绪记录
   * @param {number} id 情绪id
   * @param {string} desc 产生该情绪的描述
   * @return
   */
  function addRecord(id: number, desc: string = "") {
    const p = currentProfile.value;
    if (!p) return;
    const target = p.emos.find((item: EmoType) => item.id === id);
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
    const p = currentProfile.value;
    if (!p) return;
    const targetEmoIndex = p.emos.findIndex((item: EmoType) => item.id === eid);
    if (targetEmoIndex === -1) {
      return;
    }
    let targetRecordIndex = p.emos[targetEmoIndex].record.findIndex(
      (item: RecordType) => item.id === rid
    );
    if (targetRecordIndex === -1) {
      return;
    }
    p.emos[targetEmoIndex].record[targetRecordIndex] = {
      ...p.emos[targetEmoIndex].record[targetRecordIndex],
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
    const p = currentProfile.value;
    if (!p) return;
    const targetEmoIndex = p.emos.findIndex((item: EmoType) => item.id === eid);
    if (targetEmoIndex === -1) {
      return;
    }
    const targetRecordIndex = p.emos[targetEmoIndex].record.findIndex(
      (item) => item.id === rid
    );
    if (targetRecordIndex === -1) {
      return;
    }
    p.emos[targetEmoIndex].record.splice(targetRecordIndex, 1);
    save();
  }

  // 获取记录信息
  function getRecord(eid: number, rid: number) {
    const p = currentProfile.value;
    if (!p) return;
    const targetEmo = p.emos.find((item: EmoType) => item.id === eid);
    if (!targetEmo) {
      return;
    }
    return targetEmo.record.find((item: RecordType) => item.id === rid);
  }

  function transferRecord(eid: number, rid: number, targetEid: number) {
    const p = currentProfile.value;
    if (!p) return;
    const sourceEmoIndex = p.emos.findIndex((item: EmoType) => item.id === eid);
    if (sourceEmoIndex === -1) {
      return;
    }
    const recordIndex = p.emos[sourceEmoIndex].record.findIndex(
      (item: RecordType) => item.id === rid
    );
    if (recordIndex === -1) {
      return;
    }
    let [record] = p.emos[sourceEmoIndex].record.splice(recordIndex, 1);
    const targetEmoIndex = p.emos.findIndex(
      (item: EmoType) => item.id === targetEid
    );
    if (targetEmoIndex === -1) {
      return;
    }
    record.id = getId(p.emos[targetEmoIndex].record.map((item) => item.id));
    p.emos[targetEmoIndex].record.push(record);
    save();
  }

  return {
    data,
    profileList,
    currentProfileName,
    currentProfile,
    createProfile,
    updateProfileName,
    deleteProfile,
    switchProfile,
    transferEmoToProfile,
    emoArray,
    emoList,
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
    getRecord,
    transferRecord,
  };
});
