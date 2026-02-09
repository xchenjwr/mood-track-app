<script setup lang="ts">
import { onLaunch } from "@dcloudio/uni-app";
import { useEmoStore } from "@/stores/user";

const { getEmoInfo } = useEmoStore();

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
</style>
