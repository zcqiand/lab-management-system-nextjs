/** 合同/委托（M02.F01） */
export type ContractStatus = 'active' | 'archived';

export interface Contract {
  id: string;
  contractCode: string;
  clientUnit: string;
  projectName: string;
  projectLocation?: string;
  constructionUnit: string;
  /** 检测专项编码（FK → InspectionSpecialty.code）；合同按专项分类 */
  inspectionSpecialtyCode?: string;
  /** 建设单位 */
  buildingUnit?: string;
  /** 监理单位 */
  supervisorUnit?: string;
  /** 送检人员姓名 */
  inspectionPerson?: string;
  /** 送检人员联系电话 */
  inspectionPhone?: string;
  witnessUnit: string;
  witness: string;
  witnessPhone?: string;
  contactPerson?: string;
  contactPhone?: string;
  entrustedDate?: string;
  status: ContractStatus;
  createdAt: string;
  updatedAt: string;
}