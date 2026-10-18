/**
 * AutoBPMN Shared Graph Model & Synchronization Engine
 * Maintains a strict single source of truth between BPMN 2.0 XML and structured AutoBPMNGraph.
 */

/**
 * Mem-parse BPMN 2.0 XML kembali menjadi objek AutoBPMNGraph terstruktur.
 * Dipanggil setiap kali Visual Modeler melakukan perubahan pada diagram kanvas.
 */
export function syncXmlToGraph(xmlString, existingGraph = null) {
  if (!xmlString) return existingGraph;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');

    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      console.warn('XML Parse error during sync:', parserError.textContent);
      return existingGraph;
    }

    const processEl = doc.querySelector('process') || doc.querySelector('bpmn\\:process');
    const processId = processEl?.getAttribute('id') || existingGraph?.process_id || 'process_1';
    const processName = processEl?.getAttribute('name') || existingGraph?.process_name || 'Alur Proses Bisnis';

    const existingNodeMap = new Map((existingGraph?.nodes || []).map((n) => [n.id, n]));
    const existingActors = new Set(existingGraph?.actors || []);

    const supportedNodeTypes = [
      'startEvent',
      'userTask',
      'serviceTask',
      'exclusiveGateway',
      'parallelGateway',
      'endEvent',
    ];

    const nodes = [];

    supportedNodeTypes.forEach((type) => {
      const elements = doc.querySelectorAll(type);
      const prefixedElements = doc.querySelectorAll(`bpmn\\:${type}`);
      const combined = Array.from(new Set([...Array.from(elements), ...Array.from(prefixedElements)]));

      combined.forEach((el) => {
        const id = el.getAttribute('id');
        if (!id) return;

        const name = el.getAttribute('name') || id;
        const prev = existingNodeMap.get(id);

        // Ambil aktor dari properti custom, documentation, atau state lama
        let actor = el.getAttribute('actor') || prev?.actor || '';
        if (!actor) {
          const docEl = el.querySelector('documentation') || el.querySelector('bpmn\\:documentation');
          if (docEl && docEl.textContent) {
            const actorMatch = docEl.textContent.match(/actor:\s*([^;\n]+)/i);
            if (actorMatch) actor = actorMatch[1].trim();
          }
        }
        if (!actor && (type === 'userTask' || type === 'serviceTask')) {
          actor = type === 'serviceTask' ? 'System' : 'Pemohon';
        }

        if (actor) existingActors.add(actor);

        nodes.push({
          id,
          type,
          name,
          actor: actor || '',
        });
      });
    });

    // Parse Sequence Flows (Edges)
    const edges = [];
    const flowElements = [
      ...Array.from(doc.querySelectorAll('sequenceFlow')),
      ...Array.from(doc.querySelectorAll('bpmn\\:sequenceFlow')),
    ];
    const uniqueFlows = Array.from(new Set(flowElements));

    uniqueFlows.forEach((flow) => {
      const sourceRef = flow.getAttribute('sourceRef');
      const targetRef = flow.getAttribute('targetRef');
      if (sourceRef && targetRef) {
        const condition = flow.getAttribute('name') || null;
        edges.push({
          from_node: sourceRef,
          to_node: targetRef,
          condition,
        });
      }
    });

    return {
      process_id: processId,
      process_name: processName,
      actors: Array.from(existingActors),
      nodes,
      edges,
    };
  } catch (err) {
    console.error('Error syncing XML to Graph:', err);
    return existingGraph;
  }
}

/**
 * Validasi struktural graf proses murni di browser (Client-side BPMN validation)
 */
export function validateGraphLocally(graph) {
  if (!graph || !graph.nodes) {
    return { is_valid: false, issues: ['Graf diagram kosong.'], deadlocks: [], orphan_nodes: [] };
  }

  const issues = [];
  const deadlocks = [];
  const orphan_nodes = [];

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const startNodes = graph.nodes.filter((n) => n.type === 'startEvent');
  const endNodes = graph.nodes.filter((n) => n.type === 'endEvent');

  if (startNodes.length === 0) issues.push("Diagram tidak memiliki 'startEvent'.");
  if (endNodes.length === 0) issues.push("Diagram tidak memiliki 'endEvent'.");

  const adjOut = new Map();
  const adjIn = new Map();
  graph.nodes.forEach((n) => {
    adjOut.set(n.id, []);
    adjIn.set(n.id, []);
  });

  (graph.edges || []).forEach((e) => {
    if (!nodeMap.has(e.from_node)) {
      issues.push(`Koneksi merujuk node asal yang tidak ada: ${e.from_node}`);
    } else {
      adjOut.get(e.from_node)?.push(e.to_node);
    }

    if (!nodeMap.has(e.to_node)) {
      issues.push(`Koneksi merujuk node tujuan yang tidak ada: ${e.to_node}`);
    } else {
      adjIn.get(e.to_node)?.push(e.from_node);
    }
  });

  // Cek Deadlock & Orphan
  graph.nodes.forEach((node) => {
    if (node.type !== 'endEvent' && (adjOut.get(node.id) || []).length === 0) {
      deadlocks.push(node.id);
      issues.push(`Deadlock pada '${node.name || node.id}': tidak ada alur keluar.`);
    }

    if (node.type !== 'startEvent' && (adjIn.get(node.id) || []).length === 0) {
      orphan_nodes.push(node.id);
      issues.push(`Orphan node '${node.name || node.id}': tidak memiliki alur masuk.`);
    }
  });

  // Reachability check (BFS dari start)
  if (startNodes.length > 0 && endNodes.length > 0) {
    const visited = new Set();
    const queue = startNodes.map((s) => s.id);

    while (queue.length > 0) {
      const curr = queue.shift();
      if (!visited.has(curr)) {
        visited.add(curr);
        const neighbors = adjOut.get(curr) || [];
        neighbors.forEach((nbr) => {
          if (!visited.has(nbr)) queue.push(nbr);
        });
      }
    }

    graph.nodes.forEach((node) => {
      if (!visited.has(node.id) && !orphan_nodes.includes(node.id)) {
        issues.push(`Node '${node.name || node.id}' tidak dapat dicapai dari Start Event.`);
      }
    });
  }

  return {
    is_valid: issues.length === 0,
    issues,
    deadlocks,
    orphan_nodes,
  };
}

/**
 * Menghitung perbedaan terstruktur (Diff) antara dua graf
 */
export function computeGraphDiff(before, after) {
  if (!before || !after) {
    return { added_nodes: [], removed_nodes: [], modified_nodes: [], added_edges: [], removed_edges: [], modified_edges: [], total_changes: 0 };
  }

  const beforeNodes = new Map(before.nodes.map((n) => [n.id, n]));
  const afterNodes = new Map(after.nodes.map((n) => [n.id, n]));

  const added_nodes = after.nodes.filter((n) => !beforeNodes.has(n.id));
  const removed_nodes = before.nodes.filter((n) => !afterNodes.has(n.id));
  const modified_nodes = [];

  beforeNodes.forEach((bNode, id) => {
    const aNode = afterNodes.get(id);
    if (aNode) {
      const changes = {};
      if (bNode.name !== aNode.name) changes.name = { from: bNode.name, to: aNode.name };
      if (bNode.actor !== aNode.actor) changes.actor = { from: bNode.actor, to: aNode.actor };
      if (bNode.type !== aNode.type) changes.type = { from: bNode.type, to: aNode.type };
      if (Object.keys(changes).length > 0) {
        modified_nodes.push({ id, changes });
      }
    }
  });

  const edgeKey = (e) => `${e.from_node}->${e.to_node}`;
  const beforeEdges = new Map(before.edges.map((e) => [edgeKey(e), e]));
  const afterEdges = new Map(after.edges.map((e) => [edgeKey(e), e]));

  const added_edges = after.edges.filter((e) => !beforeEdges.has(edgeKey(e)));
  const removed_edges = before.edges.filter((e) => !afterEdges.has(edgeKey(e)));
  const modified_edges = [];

  beforeEdges.forEach((bEdge, key) => {
    const aEdge = afterEdges.get(key);
    if (aEdge && bEdge.condition !== aEdge.condition) {
      modified_edges.append({
        from_node: bEdge.from_node,
        to_node: bEdge.to_node,
        condition: { from: bEdge.condition, to: aEdge.condition },
      });
    }
  });

  return {
    added_nodes,
    removed_nodes,
    modified_nodes,
    added_edges,
    removed_edges,
    modified_edges,
    total_changes: added_nodes.length + removed_nodes.length + modified_nodes.length + added_edges.length + removed_edges.length + modified_edges.length,
  };
}

/**
 * Menerapkan GraphPatch secara deterministik di sisi klien (Local Patch Engine)
 */
export function applyLocalPatch(graph, patch) {
  if (!graph || !patch || !Array.isArray(patch.operations)) {
    return { success: false, newGraph: graph, issues: ['Patch tidak valid'], diff: null };
  }

  const issues = [];
  const newGraph = JSON.parse(JSON.stringify(graph));
  const nodeMap = new Map(newGraph.nodes.map((n) => [n.id, n]));
  const actorsSet = new Set(newGraph.actors || []);

  patch.operations.forEach((op, idx) => {
    switch (op.op) {
      case 'add_node': {
        const node = op.node;
        if (!node || !node.id || nodeMap.has(node.id)) {
          issues.push(`Operasi #${idx + 1} [add_node]: ID node tidak valid atau duplikat: ${node?.id}`);
        } else {
          newGraph.nodes.push(node);
          nodeMap.set(node.id, node);
          if (node.actor) actorsSet.add(node.actor);
        }
        break;
      }
      case 'remove_node': {
        const nid = op.node_id;
        if (!nid || !nodeMap.has(nid)) {
          issues.push(`Operasi #${idx + 1} [remove_node]: Node '${nid}' tidak ditemukan`);
        } else {
          newGraph.nodes = newGraph.nodes.filter((n) => n.id !== nid);
          nodeMap.delete(nid);
          newGraph.edges = newGraph.edges.filter((e) => e.from_node !== nid && e.to_node !== nid);
        }
        break;
      }
      case 'update_node': {
        const nid = op.node_id;
        const target = nodeMap.get(nid);
        if (!target) {
          issues.push(`Operasi #${idx + 1} [update_node]: Node '${nid}' tidak ditemukan`);
        } else {
          if (op.name !== undefined) target.name = op.name;
          if (op.actor !== undefined) {
            target.actor = op.actor;
            actorsSet.add(op.actor);
          }
          if (op.type !== undefined) target.type = op.type;
        }
        break;
      }
      case 'add_edge': {
        const edge = op.edge || op;
        if (!nodeMap.has(edge.from_node) || !nodeMap.has(edge.to_node)) {
          issues.push(`Operasi #${idx + 1} [add_edge]: Node asal atau tujuan tidak ditemukan`);
        } else {
          const exists = newGraph.edges.some((e) => e.from_node === edge.from_node && e.to_node === edge.to_node);
          if (exists) {
            newGraph.edges.forEach((e) => {
              if (e.from_node === edge.from_node && e.to_node === edge.to_node) {
                e.condition = edge.condition;
              }
            });
          } else {
            newGraph.edges.push({
              from_node: edge.from_node,
              to_node: edge.to_node,
              condition: edge.condition || null,
            });
          }
        }
        break;
      }
      case 'remove_edge': {
        newGraph.edges = newGraph.edges.filter((e) => !(e.from_node === op.from_node && e.to_node === op.to_node));
        break;
      }
      case 'update_edge': {
        const edge = newGraph.edges.find((e) => e.from_node === op.from_node && e.to_node === op.to_node);
        if (edge) {
          edge.condition = op.condition;
        } else {
          issues.push(`Operasi #${idx + 1} [update_edge]: Alur '${op.from_node}' ke '${op.to_node}' tidak ditemukan`);
        }
        break;
      }
      case 'insert_step_between': {
        const fromN = op.from_node;
        const toN = op.to_node;
        const newNode = op.new_node;

        if (!nodeMap.has(fromN) || !nodeMap.has(toN)) {
          issues.push(`Operasi #${idx + 1} [insert_step_between]: Node '${fromN}' atau '${toN}' tidak ditemukan`);
        } else if (!newNode || !newNode.id || nodeMap.has(newNode.id)) {
          issues.push(`Operasi #${idx + 1} [insert_step_between]: ID node baru tidak valid atau duplikat`);
        } else {
          // 1. Tambah node
          newGraph.nodes.push(newNode);
          nodeMap.set(newNode.id, newNode);
          if (newNode.actor) actorsSet.add(newNode.actor);

          // 2. Ambil condition lama jika ada
          let oldCondition = null;
          newGraph.edges = newGraph.edges.filter((e) => {
            if (e.from_node === fromN && e.to_node === toN) {
              oldCondition = e.condition;
              return false;
            }
            return true;
          });

          // 3. Tambah alur masuk dan alur keluar
          newGraph.edges.push({
            from_node: fromN,
            to_node: newNode.id,
            condition: op.condition_from !== undefined ? op.condition_from : oldCondition,
          });
          newGraph.edges.push({
            from_node: newNode.id,
            to_node: toN,
            condition: op.condition_to !== undefined ? op.condition_to : null,
          });
        }
        break;
      }
      default:
        issues.push(`Operasi #${idx + 1}: Tipe tidak dikenali: ${op.op}`);
    }
  });

  newGraph.actors = Array.from(actorsSet);
  const validation = validateGraphLocally(newGraph);
  if (!validation.is_valid) {
    issues.push(...validation.issues);
  }

  const diff = computeGraphDiff(graph, newGraph);
  const success = issues.length === 0;

  return {
    success,
    newGraph: success ? newGraph : graph,
    issues,
    diff,
  };
}
