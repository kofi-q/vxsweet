#!/usr/bin/env bash

set -euo pipefail

git add script/tanstack_query_v5.sh
git checkout .

for ext in .ts .tsx; do
  for dir in apps libs; do
    comby 'return useQuery(:[key], :[fn], {:[opts]}...)' 'return useQuery({queryKey: :[key], queryFn: :[fn], :[opts]})' ${ext} -d ${dir} -i -exclude-dir node_modules
    comby '= useQuery(:[key], :[fn], {:[opts]}...)' '= useQuery({queryKey: :[key], queryFn: :[fn], :[opts]})' ${ext} -d ${dir} -i -exclude-dir node_modules

    comby 'return useQuery(:[key], :[fn])' 'return useQuery({queryKey: :[key], queryFn: :[fn]})' ${ext} -d ${dir} -i -exclude-dir node_modules
    comby '= useQuery(:[key], :[fn])' '= useQuery({queryKey: :[key], queryFn: :[fn]})' ${ext} -d ${dir} -i -exclude-dir node_modules

    comby 'return useMutation(:[fn], {:[opts]}...)' 'return useMutation({mutationFn: :[fn], :[opts]})' ${ext} -d ${dir} -i -exclude-dir node_modules
    comby ' useMutation(:[fn], {:[opts]}...)' ' useMutation({mutationFn: :[fn], :[opts]})' ${ext} -d ${dir} -i -exclude-dir node_modules

    comby 'return useMutation(:[[fnNs]]:[fn])' 'return useMutation({mutationFn: :[[fnNs]]:[fn]})' ${ext} -d ${dir} -i -exclude-dir node_modules
    comby '= useMutation(:[[fnNs]]:[fn])' '= useMutation({mutationFn: :[fnNs]:[fn]})' ${ext} -d ${dir} -i -exclude-dir node_modules
    comby '=> useMutation(:[[fnNs]]:[fn])' '=> useMutation({mutationFn: :[fnNs]:[fn]})' ${ext} -d ${dir} -i -exclude-dir node_modules

    comby 'invalidateQueries(:[key])' 'invalidateQueries({queryKey: :[key]})' ${ext} -d ${dir} -i -exclude-dir node_modules
    comby 'invalidateQueries({queryKey: :[key], {:[opts]}})' 'invalidateQueries({queryKey: :[key], :[opts]})' ${ext} -d ${dir} -i -exclude-dir node_modules
    comby 'removeQueries(:[key])' 'removeQueries({queryKey: :[key]})' ${ext} -d ${dir} -i -exclude-dir node_modules

  done
done

comby 'UseQueryOptions<:[type]>' 'Partial<UseQueryOptions<:[type]>>' .ts -dir apps -i

rg useErrorBoundary -l apps | xargs sed -i '' 's/useErrorBoundary/throwOnError/g'
rg useErrorBoundary -l libs | xargs sed -i '' 's/useErrorBoundary/throwOnError/g'

rg cacheTime: -l apps | xargs sed -i '' 's/cacheTime:/gcTime:/g'
rg cacheTime: -l libs | xargs sed -i '' 's/cacheTime:/gcTime:/g'

rg Mutation.isLoading -l apps | xargs sed -i '' 's/Mutation.isLoading/Mutation.isPending/g'
rg Mutation.isLoading -l libs | xargs sed -i '' 's/Mutation.isLoading/Mutation.isPending/g'

rg "case 'loading'" -l apps | xargs sed -i '' "s/case 'loading'/case 'pending'/g"
rg "case 'loading'" -l libs | xargs sed -i '' "s/case 'loading'/case 'pending'/g"

rg "status === 'loading'" -l apps | xargs sed -i '' "s/status === 'loading'/status === 'pending'/g"
rg "status === 'loading'" -l libs | xargs sed -i '' "s/status === 'loading'/status === 'pending'/g"
