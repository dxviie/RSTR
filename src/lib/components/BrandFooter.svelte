<script>
    const year = new Date().getFullYear();
</script>

<div class="footer description">
  <div class="footer-content">
    <div class="footer-content__left">
      <div>
        <p>made with 🧡 by <a href="https://www.d17e.dev" target="_blank">d17e.dev</a></p>
        <p><a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank">© CC BY-NC 4.0</a>{" "}| {year} </p>
      </div>
    </div>
    <div class="footer-content__right">
      <span>KvK - 87650770</span>
      <span>BTW - NL004463884B92</span>
    </div>
  </div>
</div>

<style>
    a {
        border-style: dashed;
        border-bottom-width: 1px;
        border-color: hsl(var(--foreground));
    }

    a:hover {
        border-color: darkorange;
    }

    .footer {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 1rem 0
    }

    @media (max-width: 768px) {
        .footer-content {
            flex-direction: column;
            gap: .5rem;
        }

        .footer-content__left {
            text-align: center;
        }

        .footer-content__right {
            text-align: center;
        }
    }

    .footer-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        /*max-width: 50rem;*/
        padding: 0 20px;
    }

    .footer-content__left {
        font-size: 0.8rem;
    }

    .footer-content__right {
        display: flex;
        flex-direction: column;
        font-size: 0.8rem;
    }
</style>