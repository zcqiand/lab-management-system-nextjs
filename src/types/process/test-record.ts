/** 单项检测记录（M03.F03）——归属样品 sampleId；人工录入检测结果 + 单项评定。 */

export interface TestRecord {
  id: string;
  sampleId: string;
  parameterCode: string;
  standardCode?: string;
  requirementCode?: string;
  /** 技术要求显示文本，如「≥ 400 MPa」 */
  requirement: string;
  /** 检测结果 */
  result: string;
  /** 单项评定文本（人工）：合格、不合格、符合、不符合；空=未评定 */
  verdict?: string;
  createdAt: string;
  updatedAt: string;
}
