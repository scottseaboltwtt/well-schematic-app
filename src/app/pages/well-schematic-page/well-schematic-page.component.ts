import { Component } from '@angular/core';
import { WellSchematic3dComponent } from '../../components/well-schematic-3d/well-schematic-3d.component';
import { ParamsSidebarComponent } from '../../components/params-sidebar/params-sidebar.component';
import { WellSchematicParams, DEFAULT_PARAMS } from '../../models/well-schematic.model';

@Component({
  selector: 'app-well-schematic-page',
  standalone: true,
  imports: [WellSchematic3dComponent, ParamsSidebarComponent],
  templateUrl: './well-schematic-page.component.html',
  styleUrl: './well-schematic-page.component.css',
})
export class WellSchematicPageComponent {
  params: WellSchematicParams = { ...DEFAULT_PARAMS };
  showOffsetWell = false;
  offsetWell: WellSchematicParams = (() => {
    const p = { ...DEFAULT_PARAMS };
    p.wellName = 'Offset Well A';
    p.totalDepth = 8200;
    p.kopDepth = 6400;
    p.surfaceCasingDepth = 3400;
    p.intermediateCasingDepth = 6400;
    p.productionCasingDepth = 8200;
    p.perforationDepths = [7300, 7600, 7900];
    p.packerDepths = [7200, 7800];
    p.bitDepth = 8200;
    p.eocDepth = 7100;
    p.lossesDepths = [4100];
    return p;
  })();

  onParamsChange(p: WellSchematicParams): void {
    this.params = p;
  }
}
