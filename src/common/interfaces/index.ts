/**
 * desc 情绪描述
 * time 产生时间
 */
interface RecordType {
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
  record: Array<RecordType>;
}

/**
 * 一个“对象/分组”（例如：个人、张三朋友）
 */
interface ProfileType {
  id: number;
  name: string;
  emos: Array<EmoType>;
}

/**
 * App 根数据（v2）
 */
interface AppDataV2 {
  version: 2;
  currentProfileId: number;
  profiles: Array<ProfileType>;
}

export type { RecordType, EmoType, ProfileType, AppDataV2 };
