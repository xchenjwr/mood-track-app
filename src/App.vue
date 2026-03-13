<script setup lang="ts">
import { onLaunch } from "@dcloudio/uni-app";
import { useEmoStore } from "@/stores/user";
import { ref } from "vue";

const { getEmoInfo } = useEmoStore();

let globalData = ref({
  currentTab: 0,
});

onLaunch(() => {
  console.log("App Launch" + Date.now());
  getEmoInfo();
});
</script>

<style lang="scss">
@import "uview-plus/index.scss";
page {
  background-color: #f3f4f6;
}
.w-100 {
  width: 100%;
}
.no-list-data {
  margin-top: 150px !important;
}
.pd-15 {
  padding: 15px;
}
</style>
