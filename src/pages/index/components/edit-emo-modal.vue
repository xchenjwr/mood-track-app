<template>
  <view>
    <up-modal :show="show" showCancelButton @cancel="cancel" @confirm="submit">
      <up-form
        class="w-100 h60"
        labelWidth="auto"
        :model="emoData"
        :rules="emoRules"
        ref="form">
        <up-form-item label="修改情绪" prop="name">
          <up-input
            v-model="emoData.name"
            placeholder="10字以内"
            maxlength="10"></up-input>
        </up-form-item>
      </up-form>
    </up-modal>
  </view>
</template>
<script setup lang="ts">
import { ref, toRefs, computed } from "vue";
import { storeToRefs } from "pinia";
import { useEmoStore } from "@/stores/user";

const props = defineProps({
  show: Boolean,
  id: Number,
  name: String,
});

const emit = defineEmits(["update:show"]);

const { show, id, name } = toRefs(props);

const store = useEmoStore();
const { updateEmo } = store;

const { emoNameArray } = storeToRefs(store);

const form = ref(null);
const emoData = computed(() => {
  return {
    name: name?.value,
  };
});
const emoRules = {
  name: [
    {
      required: true,
      message: "不可为空",
    },
    {
      validator: (rule: any, value: string) =>
        emoNameArray.value.every((item: string) => item !== value),
      message: "重名",
    },
  ],
};

function cancel() {
  emit("update:show", false);
}

function submit() {
  (form.value as any)
    .validate()
    .then((valid: boolean) => {
      if (valid && id?.value && emoData.value.name) {
        updateEmo(id.value, emoData.value.name);
        emit("update:show", false);
        uni.showToast({ title: "修改成功", icon: "success", duration: 2000 });
      }
    })
    .catch(() => {});
}
</script>

<style lang="less">
.h60 {
  height: 60px;
}
</style>
