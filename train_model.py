import csv
import json
from pathlib import Path

from sklearn.tree import DecisionTreeClassifier


ROOT = Path(__file__).parent
FEATURES = ["moisture", "temperature", "rain"]


def build_model():
    inputs = []
    labels = []
    with (ROOT / "training_examples.csv").open(newline="", encoding="utf-8") as file:
        for row in csv.DictReader(file):
            inputs.append([float(row[name]) for name in FEATURES])
            labels.append(row["urgency"])

    if set(labels) != {"Now", "Soon", "Wait"}:
        raise ValueError("The examples must contain Now, Soon, and Wait labels.")

    classifier = DecisionTreeClassifier(max_depth=6, random_state=42)
    classifier.fit(inputs, labels)
    tree = classifier.tree_
    nodes = []
    for index in range(tree.node_count):
        feature_index = int(tree.feature[index])
        nodes.append({
            "id": index,
            "feature": FEATURES[feature_index] if feature_index >= 0 else None,
            "threshold": round(float(tree.threshold[index]), 4) if feature_index >= 0 else None,
            "left": int(tree.children_left[index]) if feature_index >= 0 else None,
            "right": int(tree.children_right[index]) if feature_index >= 0 else None,
            "prediction": str(classifier.classes_[tree.value[index][0].argmax()]),
            "samples": int(tree.n_node_samples[index]),
        })

    return {"trainingExamples": len(labels), "features": FEATURES, "nodes": nodes}


if __name__ == "__main__":
    model = build_model()
    output = (
        "// Generated from training_examples.csv by train_model.py.\n"
        "const IRRIGATION_MODEL = " + json.dumps(model, indent=2) + ";\n"
        "if (typeof window !== 'undefined') window.IRRIGATION_MODEL = IRRIGATION_MODEL;\n"
        "if (typeof module !== 'undefined') module.exports = IRRIGATION_MODEL;\n"
    )
    (ROOT / "model.js").write_text(output, encoding="utf-8")
    print(f"Exported {len(model['nodes'])} tree nodes from {model['trainingExamples']} examples.")
