<script lang="ts">

  import paper from "paper";
  import {onMount} from "svelte";

  let canvas: HTMLCanvasElement;
  let project: paper.Project;
  let zoom = 1;

  // let config: QrConfig | null = null;
  // qrConfigStore.subscribe(
  //   (currentConfig) => {
  //     if (!project || !currentConfig || !currentConfig.value) return;
  //     config = currentConfig;
	//
  //     console.debug('current qr config', currentConfig);
  //     // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //     // @ts-expect-error
  //     import("qrcode-svg").then(({default: QRCode}) => {
  //       /************************************************************************
  //        QR CODE GENERATION & PREPARATION
  //        ************************************************************************/
  //         // Create a new QRCode
  //       const qr = new QRCode({
  //           content: currentConfig.value,
  //           padding: 0,
  //           width: 64,
  //           height: 64,
  //           color: '#000000',
  //           background: '#ffffff',
  //           ecl: currentConfig.ecl,
  //           join: false,
  //           predefined: false
  //         });
	//
  //       // Generate the SVG string and import to paper
  //       const svg = qr.svg();
  //       console.debug('qr svg:', svg);
  //       project.clear();
  //       project.view.play();
  //       qrOutputStore.update(store => ({
  //         ...store,
  //         totalPathLength: 0,
  //         remark: 'rendering'
  //       }));
	//
  //       setTimeout(() => {
  //         project.importSVG(svg);
  //         project.view.play();
  //         console.debug('project refresh requested');
  //       }, 0);
  //     });
  //   }
  // );

  const PAPERJS_MM_TO_PT = 3.775;
  const HOR_COLOR = 'orange';
  const VERT_COLOR = 'green';

  function hasBlockAt(blocks: paper.Path.Rectangle[], point: paper.PointLike): boolean {
    return blocks.some((block) => block.contains(point));
  }

  onMount(() => {
    paper.setup(canvas);
    project = paper.project;

    project.view.onFrame = (event: { time: number; delta: number; count: number }) => {
      new paper.Path.Rectangle({
				point: [0, 0],
				size: [project.view.size.width, project.view.size.height],
				fillColor: 'green'
			});
      project.view.pause();
    };
  });
</script>

<canvas id="raster-canvas" bind:this={canvas} data-paper-hidpi="off"></canvas>

<style>
    #raster-canvas {
        display: block;
        width: calc(100vw - 42rem);
        aspect-ratio: 1;
        background-color: white;
        border-radius: .5rem;
    }
</style>