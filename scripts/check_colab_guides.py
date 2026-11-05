"""Run every Colab guide's notebook on a CPU, with tiny stand-ins, to check that the code works before a guide ships.

The course does not run its guides in Colab itself. This is the check it does instead (ROADMAP, phase 5b): each code
cell runs in order, in one namespace, the way Colab runs it, with these stand-ins:

- decoding and QLoRA: a tiny random Qwen3-shaped model and a small tokenizer with a chat template, built locally, in
  place of the real model. The answers are noise; the point is that every call works on a current Transformers and PEFT.
- train-gpt: the pinned nanoGPT, cloned for real, trained for a few steps at a tiny size on the CPU.
- vLLM: a mock OpenAI-compatible server and a mock `vllm bench serve` that writes the result fields of the pinned
  version, so the client, parsing and plotting code run. vLLM itself needs a GPU, so this does not check vLLM.

pip and nvidia-smi lines are skipped. Usage, from the repository root, in an environment with torch, transformers,
peft, accelerate, tokenizers, tiktoken, requests, numpy, matplotlib and openai:

    node scripts/colab-notebooks.ts /tmp/colab-notebooks
    python scripts/check_colab_guides.py /tmp/colab-notebooks [name-filter]
"""

import contextlib
import json
import os
import random
import re
import shlex
import subprocess
import sys
import tempfile
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

REAL_RUN = subprocess.run
REAL_POPEN = subprocess.Popen
WORK = Path(tempfile.mkdtemp(prefix="colab-check-"))


# ---- A tiny model with a chat template ---------------------------------------------------------------------------

CHAT_TEMPLATE = (
    "{%- for m in messages %}{{ '<|im_start|>' + m['role'] + '\\n' + m['content'] + '<|im_end|>\\n' }}{%- endfor %}"
    "{%- if add_generation_prompt %}{{ '<|im_start|>assistant\\n' }}"
    "{%- if enable_thinking is defined and enable_thinking is false %}{{ '<think>\\n\\n</think>\\n\\n' }}{%- endif %}"
    "{%- endif %}"
)


def tiny_model(texts):
    """A 2-layer Qwen3-shaped model with random weights, and a byte-level BPE tokenizer trained on `texts`."""
    from tokenizers import Tokenizer, decoders, models, pre_tokenizers, trainers
    from transformers import PreTrainedTokenizerFast, Qwen3Config, Qwen3ForCausalLM

    path = WORK / "tiny-qwen3"
    if path.exists():
        return str(path)
    specials = ["<|endoftext|>", "<|im_start|>", "<|im_end|>"]
    tok = Tokenizer(models.BPE())
    tok.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
    tok.decoder = decoders.ByteLevel()
    tok.train_from_iterator(texts, trainers.BpeTrainer(vocab_size=1500, special_tokens=specials, initial_alphabet=pre_tokenizers.ByteLevel.alphabet()))
    fast = PreTrainedTokenizerFast(tokenizer_object=tok, eos_token="<|im_end|>", pad_token="<|endoftext|>")
    fast.chat_template = CHAT_TEMPLATE
    fast.save_pretrained(path)
    config = Qwen3Config(
        vocab_size=len(fast), hidden_size=64, intermediate_size=128, num_hidden_layers=2, num_attention_heads=4,
        num_key_value_heads=2, head_dim=16, max_position_embeddings=8192, tie_word_embeddings=True,
        eos_token_id=fast.eos_token_id, pad_token_id=fast.pad_token_id,
    )
    Qwen3ForCausalLM(config).save_pretrained(path)
    return str(path)


# ---- A mock vLLM ---------------------------------------------------------------------------------------------------

class MockVllm(BaseHTTPRequestHandler):
    seen = set()

    def log_message(self, *args):
        pass

    def do_GET(self):
        self.send_response(200 if self.path in ("/health", "/v1/models") else 404)
        self.end_headers()
        if self.path == "/v1/models":
            self.wfile.write(json.dumps({"data": [{"id": "mock"}]}).encode())

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        prompt = "".join(m["content"] for m in body["messages"])
        # Pretend prefill costs time per character unless this prefix was seen before, as prefix caching would.
        key = prompt[:200]
        time.sleep(0.002 if key in MockVllm.seen else min(0.2, len(prompt) / 30000))
        MockVllm.seen.add(key)
        words = ["This", " is", " a", " mock", " answer", "."]
        if body.get("stream"):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.end_headers()
            for w in words:
                chunk = {"id": "x", "object": "chat.completion.chunk", "created": 0, "model": body["model"],
                         "choices": [{"index": 0, "delta": {"role": "assistant", "content": w}, "finish_reason": None}]}
                self.wfile.write(f"data: {json.dumps(chunk)}\n\n".encode())
            self.wfile.write(b"data: [DONE]\n\n")
            return
        reply = {"id": "x", "object": "chat.completion", "created": 0, "model": body["model"],
                 "choices": [{"index": 0, "message": {"role": "assistant", "content": "".join(words)}, "finish_reason": "stop"}],
                 "usage": {"prompt_tokens": len(prompt) // 4, "completion_tokens": len(words), "total_tokens": len(prompt) // 4 + len(words)}}
        data = json.dumps(reply).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


class FakeServer:
    def __init__(self, stdout):
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 8000), MockVllm)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        if hasattr(stdout, "write"):
            stdout.write("INFO mock: GPU KV cache size: 98,304 tokens\nINFO mock: Maximum concurrency for 4,096 tokens per request: 24.00x\n")
            stdout.flush()

    def poll(self):
        return None

    def terminate(self):
        self.httpd.shutdown()
        self.httpd.server_close()

    def wait(self, timeout=None):
        return 0


def mock_popen(args, *a, **kw):
    if isinstance(args, list) and args[:2] == ["vllm", "serve"]:
        return FakeServer(kw.get("stdout"))
    return REAL_POPEN(args, *a, **kw)


def mock_run(args, *a, **kw):
    if isinstance(args, list) and args[:3] == ["vllm", "bench", "serve"]:
        opt = {args[i]: args[i + 1] for i in range(3, len(args) - 1) if args[i].startswith("--")}
        c = int(opt["--max-concurrency"])
        # The fields the pinned vllm bench serve writes, with made-up numbers shaped like a real sweep.
        itl = 20 + 2 * c
        result = {"completed": int(opt["--num-prompts"]), "request_throughput": c * 0.4, "output_throughput": 60 * c / (1 + c / 12),
                  "total_token_throughput": 300 * c / (1 + c / 12), "median_ttft_ms": 80 + 10 * c, "p99_ttft_ms": 150 + 20 * c,
                  "mean_itl_ms": itl, "median_itl_ms": itl, "p99_itl_ms": itl * 1.6, "p50_itl_ms": itl,
                  "median_tpot_ms": itl, "p99_tpot_ms": itl * 1.4}
        Path(opt["--result-dir"]).mkdir(parents=True, exist_ok=True)
        Path(opt["--result-dir"], opt["--result-filename"]).write_text(json.dumps(result))
        return subprocess.CompletedProcess(args, 0, "", "")
    return REAL_RUN(args, *a, **kw)


# ---- Running a notebook --------------------------------------------------------------------------------------------

TINY_GPT = "--device=cpu --dtype=float32 --compile=False --n_layer=2 --n_head=2 --n_embd=64 --block_size=64 --batch_size=8 --eval_interval=10 --eval_iters=2 --log_interval=5"


def rewrite_shell(cmd, guide):
    """The shell line to run instead of `cmd`, or None to skip it."""
    if cmd.startswith(("pip ", "nvidia-smi")):
        return None
    if guide == "train-gpt":
        if cmd.startswith("git clone"):
            return cmd.replace("/content/nanoGPT", str(WORK / "nanoGPT"))
        if cmd.startswith("python train.py"):
            return f"{cmd} {TINY_GPT} --max_iters=20 --lr_decay_iters=20"
        if cmd.startswith("python sample.py"):
            return f"{cmd} --device=cpu --dtype=float32 --num_samples=1 --max_new_tokens=40"
    if guide == "vllm-bench" and cmd.startswith("vllm --version"):
        return "echo 'mock vllm'"
    return cmd


def to_python(source, guide):
    out = []
    for line in source.split("\n"):
        if line.startswith("!"):
            out.append(f"__shell__({line[1:]!r}, {guide!r})")
        elif line.startswith("%cd "):
            path = line[4:].strip().replace("/content/nanoGPT", str(WORK / "nanoGPT"))
            out.append(f"__import__('os').chdir({path!r})")
        else:
            out.append(line)
    return "\n".join(out)


def shell(cmd, guide):
    run = rewrite_shell(cmd, guide)
    if run is None:
        print(f"    (skipped) !{cmd}")
        return
    print(f"    $ {run}")
    # `python` in a shell line is this interpreter, as it is the notebook's own in Colab.
    env = {**os.environ, "PATH": os.path.dirname(sys.executable) + os.pathsep + os.environ.get("PATH", "")}
    REAL_RUN(run, shell=True, check=True, env=env)


def substitutions(source, guide, tiny):
    if guide in ("decoding", "qlora"):
        source = re.sub(r'^MODEL = ".*"$', f"MODEL = {tiny!r}", source, flags=re.M)
    return source


def check(nb_path):
    nb = json.loads(Path(nb_path).read_text())
    name = Path(nb_path).name
    guide = ("decoding" if name.startswith("decoding") else "train-gpt" if name.startswith("train-a-small") else
             "qlora" if name.startswith("qlora") else "vllm-bench")
    cells = ["".join(c["source"]) for c in nb["cells"] if c["cell_type"] == "code"]
    texts = [json.dumps(nb)[i:i + 400] for i in range(0, len(json.dumps(nb)), 400)]
    tiny = tiny_model(texts) if guide in ("decoding", "qlora") else None
    ns = {"__name__": "__main__", "__shell__": shell}
    cwd = os.getcwd()
    run_dir = WORK / name.removesuffix(".ipynb")
    run_dir.mkdir(exist_ok=True)
    os.chdir(run_dir)  # files a guide writes (an adapter, benchmark results) stay out of the repository
    print(f"\n== {name}")
    started = time.perf_counter()
    try:
        for i, source in enumerate(cells, 1):
            print(f"  cell {i}")
            code = to_python(substitutions(source, guide, tiny), guide)
            exec(compile(code, f"{name}:cell{i}", "exec"), ns)
        print(f"  PASS in {time.perf_counter() - started:.0f} s")
        return True
    except Exception:
        traceback.print_exc()
        print("  FAIL")
        return False
    finally:
        os.chdir(cwd)
        server = ns.get("server")
        if isinstance(server, FakeServer):
            with contextlib.suppress(Exception):
                server.terminate()


def main():
    folder = Path(sys.argv[1])
    only = sys.argv[2] if len(sys.argv) > 2 else ""
    subprocess.Popen = mock_popen
    subprocess.run = mock_run
    random.seed(0)
    results = {p.name: check(p) for p in sorted(folder.glob("*.ipynb")) if only in p.name}
    print("\n" + "\n".join(f"{'PASS' if ok else 'FAIL'}  {n}" for n, ok in results.items()))
    sys.exit(0 if results and all(results.values()) else 1)


if __name__ == "__main__":
    main()
