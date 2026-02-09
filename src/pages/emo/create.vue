<template>
  <view>
    <!-- 导航栏 -->
    <up-navbar
      :title="id ? '添加' + emoName + '记录' : '创建情绪'"
      @left-click="goBack"
      :placeholder="true"
    ></up-navbar>
    <view class="form">
      <up-form
        labelPosition="top"
        :model="emoData"
        :rules="emoRules"
        ref="form"
      >
        <up-form-item v-show="!id" label="情绪" prop="name">
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
import { reactive, ref } from "vue";
import { storeToRefs } from "pinia";
import { onLoad } from "@dcloudio/uni-app";
import { useEmoStore } from "@/stores/user";

const emoStore = useEmoStore();
const { createEmo, addRecord } = emoStore;
const { emoNameArray } = storeToRefs(emoStore);
let emoData = reactive({ name: "", desc: "" });
let id = ref(0);
let emoName = ref(""); // 已有情绪
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

onLoad((option: any) => {
  id.value = Number(option.id) || 0;
  emoName = option.name || "";
});

function goBack() {
  uni.navigateTo({
    url: "/pages/index/index",
  });
}

function submit() {
  if (id.value) {
    addRecord(id.value, emoData.desc);
    uni.navigateTo({
      url: "/pages/index/index",
    });
  } else {
    (form.value as any)
      .validate()
      .then((valid: Boolean) => {
        if (valid) {
          createEmo(emoData.name, emoData.desc);
          uni.navigateTo({
            url: "/pages/index/index",
          });
        }
      })
      .catch(() => {});
  }
}
</script>

<style lang="less">
.form {
  margin: 10px;
  padding: 15px;
  background-color: #fff;
}
</style>
