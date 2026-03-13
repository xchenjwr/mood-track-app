<template>
  <view @click="renderJs.chooseFileInApp">
    <up-cell title="导入" :isLink="true"></up-cell>
  </view>
</template>
<script>
import { mapActions } from "pinia";
import { useEmoStore } from "@/stores/user";
export default {
  methods: {
    ...mapActions(useEmoStore, ["importEmoData"]),
    onViewClick(event) {
      const data = event.data;
      this.importEmoData(data);
    },
  },
};
</script>
<script module="renderJs" lang="renderjs">
export default {
  methods: {
    chooseFileInApp(e, ownerInstance) {
        let fileInput = document.createElement("input");
        fileInput.setAttribute("type", "file");
        fileInput.setAttribute("accept", ".json,application/json");
        fileInput.click();
        fileInput.addEventListener("change", async (e) => {
            const file = event.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const jsonData = JSON.parse(text);
                ownerInstance.callMethod('onViewClick', {
                  data: jsonData
                })
            } catch (error) {
              uni.showToast({ title: "导入失败", icon: "none", duration: 3000 });
            }
        });
    }
  }
}
</script>
