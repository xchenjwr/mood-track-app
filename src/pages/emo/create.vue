<template>
  <view>
    <!-- 导航栏 -->
    <up-navbar :title="getTitle" @left-click="goBack" :placeholder="true" />
    <view class="form">
      <up-form
        labelPosition="top"
        :model="emoData"
        :rules="emoRules"
        ref="form"
      >
        <up-form-item v-if="!id" label="情绪" prop="name">
          <up-input
            v-model="emoData.name"
            placeholder="10字以内"
            maxlength="10"
          ></up-input>
        </up-form-item>
        <up-form-item label="描述" prop="desc">
          <up-textarea
            v-model="emoData.desc"
            placeholder="50字以内"
            count
            maxlength="50"
          ></up-textarea>
        </up-form-item>
      </up-form>
      <up-button type="primary" @click="submit">提交</up-button>
    </view>
  </view>
</template>

<script lang="ts" setup>
import { reactive, ref, computed } from "vue";
import { storeToRefs } from "pinia";
import { onLoad } from "@dcloudio/uni-app";
import { useEmoStore } from "@/stores/user";

// 页面模式：0-编辑记录，1-添加记录，2-创建情绪
const enum PageMode {
  EditRecord = 0,
  AddRecord = 1,
  CreateEmo = 2,
}
const emoStore = useEmoStore();
const { createEmo, getEmo, addRecord, getRecord, updateRecord } = emoStore;
const { emoNameArray } = storeToRefs(emoStore);
let emoData = reactive({ name: "", desc: "" });
let id = ref(0);
let rid = ref(0);
const form = ref(null);
const emoRules = {
  name: [
    {
      required: true,
      message: "请输入情绪",
    },
    {
      validator: (rule: any, value: string) =>
        emoNameArray.value.every((item: string) => item !== value),
      message: "已有过该情绪",
    },
  ],
};
const pageMode = computed(() => {
  if (id.value && rid.value) return PageMode.EditRecord;
  if (id.value) return PageMode.AddRecord;
  return PageMode.CreateEmo;
});
const getTitle = computed(() => {
  switch (pageMode.value) {
    case PageMode.EditRecord:
      return `编辑${emoData.name}记录`;
    case PageMode.AddRecord:
      return `添加${emoData.name}记录`;
    case PageMode.CreateEmo:
      return "创建情绪";
    default:
      return "";
  }
});

onLoad((option: any) => {
  id.value = Number(option.id) || 0;
  if (!id.value) {
    return;
  }
  emoData.name = getEmo(id.value)?.name || "";
  rid.value = Number(option.rid) || 0;
  if (!rid.value) {
    return;
  }
  const record = getRecord(id.value, rid.value);
  if (record) {
    emoData.desc = record.desc;
  }
});

function goBack() {
  uni.navigateBack();
}

function validateForm() {
  if (!form.value) {
    return Promise.resolve(false);
  }
  return (form.value as any)
    .validate()
    .then((valid: boolean) => valid)
    .catch(() => false);
}

async function submit() {
  const res = await validateForm();
  if (!res) {
    return;
  }
  switch (pageMode.value) {
    case PageMode.EditRecord:
      updateRecord(id.value, rid.value, emoData.desc);
      break;
    case PageMode.AddRecord:
      addRecord(id.value, emoData.desc);
      break;
    case PageMode.CreateEmo:
      createEmo(emoData.name, emoData.desc);
      break;
    default:
      break;
  }
  uni.navigateBack();
}
</script>

<style lang="less">
.form {
  margin: 10px;
  padding: 15px;
  background-color: #fff;
}
</style>
