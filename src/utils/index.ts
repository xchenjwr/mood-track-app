/**
 * 获取自增ID
 * arr 数据ID数组
 */
function getId(arr: Array<number>) {
  let i: number = 1;
  while (true) {
    if (arr.every((item) => item !== i)) {
      break;
    }
    i++;
  }
  return i;
}

/**
 * 智能格式化时间戳
 * @param {number} timestamp - 时间戳（毫秒）
 * @returns {string} 格式化后的时间字符串
 */
function smartFormatTime(timestamp: number) {
  const now = new Date();
  const target = new Date(timestamp);
  const nowYear = now.getFullYear();
  const targetYear = target.getFullYear();
  const nowDate = now.getDate();
  const targetDate = target.getDate();

  // 是否是今天
  const isToday =
    target.getFullYear() === nowYear &&
    target.getMonth() === now.getMonth() &&
    targetDate === nowDate;

  // 是否是今年
  const isThisYear = targetYear === nowYear;

  // 格式化时间部分
  const formatTime = () => {
    const hours = target.getHours().toString().padStart(2, "0");
    const minutes = target.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  // 根据情况返回不同格式
  if (isToday) {
    return `${formatTime()}`;
  } else if (isThisYear) {
    const month = target.getMonth() + 1;
    const day = target.getDate();
    return `${month}-${day} ${formatTime()}`;
  } else {
    const year = target.getFullYear();
    const month = target.getMonth() + 1;
    const day = target.getDate();
    return `${year}-${month}-${day} ${formatTime()}`;
  }
}

export { getId, smartFormatTime };
