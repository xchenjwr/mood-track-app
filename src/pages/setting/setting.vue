<template>
  <view class="setting_page">
    <!-- 导航栏 -->
    <up-navbar title="设置" left-icon="" :placeholder="true"></up-navbar>
    <text class="title">数据传输</text>
    <up-cell-group class="cell_group">
      <up-cell title="导出" :isLink="true" @click="downData()"></up-cell>
      <ParseUploadData />
    </up-cell-group>
    <CustomTabBar />
  </view>
</template>

<script setup lang="ts">
import CustomTabBar from "@/common/components/custom-tab-bar.vue";
import ParseUploadData from "./components/parse-upload-data.vue";
function downData() {
  const userInfo = uni.getStorageSync("userInfo");
  saveJsonToAndroidDir(userInfo, "data.json");
}

// 安卓App简洁版：保存JSON到私有目录（同步打印日志）
function saveJsonToAndroidDir(jsonData, fileName) {
  try {
    const dir = plus.io.convertLocalFileSystemURL("_doc/");
    // 3. 解析目录并创建文件
    plus.io.resolveLocalFileSystemURL(dir, (dirEntry) => {
      dirEntry.getFile(
        fileName,
        { create: true, exclusive: false },
        (fileEntry) => {
          fileEntry.createWriter((writer) => {
            writer.seek(0);
            writer.onwrite = () => {
              uni.showToast({
                title: "保存成功",
                icon: "none",
                duration: 3000,
              });
            };
            const jsonStr = JSON.stringify(jsonData, null, 2);
            writer.write(jsonStr);
          });
        }
      );
    });
  } catch (e) {
    uni.showToast({ title: e.message, icon: "none", duration: 3000 });
  }
}
</script>
<style lang="less" scoped>
.setting_page {
  padding-top: 15px;
  .title {
    color: grey;
    padding: 15px;
  }
  .cell_group {
    margin-top: 15px;
    background-color: #fff;
  }
}
</style>
