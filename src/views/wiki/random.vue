<template>
<wiki-base v-if="nothing">
    <div class="box ic-paper ic-z1" >
        <template v-if="nothing">无处可去</template>
    </div>
</wiki-base>
</template>

<style lang="scss" scoped>
.box {
    background: $white;
    padding: 10px;
    height: 100%;
}
</style>

<script>
import api from '@/netapi.js'
import state from '@/state.js'
import { marked } from '@/md.js'
import WikiBase from './_base.vue'

export default {
    data () {
        return {
            state,
            marked,
            loading: true,
            nothing: true
        }
    },
    methods: {
        fetchData: async function () {
            let ret = await api.wiki.random()
            if (ret.code === api.retcode.SUCCESS) {
                this.nothing = false
                setTimeout(() => {
                    this.$router.replace({
                        name: 'wiki_article_by_ref',
                        params: { ref: ret.data.ref }
                    })
                }, 100)
            }
        }
    },
    created: async function () {
        // let key = state.loadingGetKey(this.$route)
        // this.state.loadingInc(this.$route, key)
        await this.fetchData()
        // this.state.loadingDec(this.$route, key)
    },
    components: {
        WikiBase
    }
}
</script>
