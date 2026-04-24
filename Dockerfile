FROM ghcr.io/astral-sh/uv:python3.11-slim

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .

EXPOSE 5001

CMD ["uv", "run", "python", "app.py"]
