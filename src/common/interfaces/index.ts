/**
 * desc 情绪描述
 * time 产生时间
 */
interface Records {
  id: number;
  desc: string;
  time: number;
  // 后续可能会有图片数组
}

/**
 * name 情绪名
 * record 情绪详情记录
 */
interface EmoType {
  id: number;
  name: string;
  record: Array<Records>;
}

export type { Records, EmoType };
