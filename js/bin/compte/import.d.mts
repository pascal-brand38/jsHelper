#!/usr/bin/env node
import { workbookHelper, dataSheetRowType } from './workbookHelper.mjs';
import '../../extend/luxon.mjs';
export interface lbpImportedType {
    lbpSolde: number;
    addRows: dataSheetRowType[];
}
export declare function importLBPData(workbookHelp: workbookHelper): Promise<lbpImportedType | undefined>;
